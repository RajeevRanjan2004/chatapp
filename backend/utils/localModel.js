const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "local-db.json");
const DEFAULT_DB = {
  users: [],
  messages: [],
  statuses: [],
  callLogs: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureLocalDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

function readDb() {
  ensureLocalDb();

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      ...clone(DEFAULT_DB),
      ...(parsed || {}),
    };
  } catch {
    return clone(DEFAULT_DB);
  }
}

function writeDb(nextDb) {
  ensureLocalDb();
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextDb, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeComparable(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}

function matchesField(value, condition) {
  if (condition && typeof condition === "object" && !Array.isArray(condition)) {
    if (Object.prototype.hasOwnProperty.call(condition, "$ne")) {
      const target = condition.$ne;
      if (Array.isArray(value)) return !value.includes(target);
      return value !== target;
    }

    if (Object.prototype.hasOwnProperty.call(condition, "$in")) {
      const values = Array.isArray(condition.$in) ? condition.$in : [];
      if (Array.isArray(value)) {
        return value.some((item) => values.includes(item));
      }
      return values.includes(value);
    }

    if (Object.prototype.hasOwnProperty.call(condition, "$gt")) {
      return normalizeComparable(value) > normalizeComparable(condition.$gt);
    }

    if (Object.prototype.hasOwnProperty.call(condition, "$gte")) {
      return normalizeComparable(value) >= normalizeComparable(condition.$gte);
    }

    if (Object.prototype.hasOwnProperty.call(condition, "$lt")) {
      return normalizeComparable(value) < normalizeComparable(condition.$lt);
    }

    if (Object.prototype.hasOwnProperty.call(condition, "$lte")) {
      return normalizeComparable(value) <= normalizeComparable(condition.$lte);
    }
  }

  return value === condition;
}

function matchesQuery(document, query = {}) {
  if (!query || !Object.keys(query).length) return true;

  if (Array.isArray(query.$and)) {
    return query.$and.every((entry) => matchesQuery(document, entry));
  }

  if (Array.isArray(query.$or)) {
    return query.$or.some((entry) => matchesQuery(document, entry));
  }

  return Object.entries(query).every(([key, condition]) => {
    if (key === "$and" || key === "$or") return true;
    return matchesField(document?.[key], condition);
  });
}

function omitFields(value, keys) {
  if (!value) return value;

  if (Array.isArray(value)) {
    return value.map((entry) => omitFields(entry, keys));
  }

  const target = value && typeof value.toObject === "function" ? value.toObject() : clone(value);
  keys.forEach((key) => {
    delete target[key];
  });
  return target;
}

class LocalQuery {
  constructor(result, single = false) {
    this.result = result;
    this.single = single;
  }

  select(selection) {
    const fields = String(selection || "")
      .split(/\s+/)
      .filter((entry) => entry.startsWith("-"))
      .map((entry) => entry.slice(1));

    if (!fields.length) return this;
    this.result = omitFields(this.result, fields);
    return this;
  }

  sort(sortSpec = {}) {
    if (this.single || !Array.isArray(this.result)) return this;

    const [field, direction] = Object.entries(sortSpec)[0] || [];
    if (!field) return this;

    this.result.sort((left, right) => {
      const leftValue = normalizeComparable(left?.[field]);
      const rightValue = normalizeComparable(right?.[field]);
      if (leftValue === rightValue) return 0;
      return leftValue > rightValue ? Number(direction || 1) : -Number(direction || 1);
    });

    return this;
  }

  limit(count) {
    if (this.single || !Array.isArray(this.result)) return this;
    this.result = this.result.slice(0, count);
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this.result).then(resolve, reject);
  }

  catch(reject) {
    return Promise.resolve(this.result).catch(reject);
  }

  finally(handler) {
    return Promise.resolve(this.result).finally(handler);
  }
}

function createLocalModel(collectionName, options = {}) {
  const defaults = options.defaults || (() => ({}));

  return class LocalModel {
    constructor(payload = {}) {
      Object.assign(this, clone(defaults(payload)));
      Object.assign(this, clone(payload));

      if (!this._id) this._id = randomUUID();
      if (!this.createdAt) this.createdAt = nowIso();
      if (!this.updatedAt) this.updatedAt = this.createdAt;
    }

    toObject() {
      return clone(this);
    }

    async save() {
      const database = readDb();
      const collection = database[collectionName] || [];
      this.updatedAt = nowIso();

      const nextDocument = clone(this);
      const existingIndex = collection.findIndex((entry) => String(entry._id) === String(this._id));

      if (existingIndex === -1) {
        collection.push(nextDocument);
      } else {
        collection[existingIndex] = nextDocument;
      }

      database[collectionName] = collection;
      writeDb(database);
      return this;
    }

    static find(query = {}) {
      const database = readDb();
      const collection = database[collectionName] || [];
      const results = collection.filter((entry) => matchesQuery(entry, query)).map((entry) => clone(entry));
      return new LocalQuery(results, false);
    }

    static findOne(query = {}) {
      const database = readDb();
      const collection = database[collectionName] || [];
      const match = collection.find((entry) => matchesQuery(entry, query));
      return Promise.resolve(match ? new this(match) : null);
    }

    static findById(id) {
      const database = readDb();
      const collection = database[collectionName] || [];
      const match = collection.find((entry) => String(entry._id) === String(id));
      return new LocalQuery(match ? new this(match) : null, true);
    }

    static async findByIdAndUpdate(id, updates = {}) {
      const database = readDb();
      const collection = database[collectionName] || [];
      const index = collection.findIndex((entry) => String(entry._id) === String(id));

      if (index === -1) return null;

      const nextDocument = {
        ...collection[index],
        ...clone(updates),
        updatedAt: nowIso(),
      };

      collection[index] = nextDocument;
      database[collectionName] = collection;
      writeDb(database);

      return new this(nextDocument);
    }

    static async deleteMany(query = {}) {
      const database = readDb();
      const collection = database[collectionName] || [];
      const remaining = collection.filter((entry) => !matchesQuery(entry, query));
      const deletedCount = collection.length - remaining.length;

      database[collectionName] = remaining;
      writeDb(database);

      return { deletedCount };
    }

    static async deleteOne(query = {}) {
      const database = readDb();
      const collection = database[collectionName] || [];
      const index = collection.findIndex((entry) => matchesQuery(entry, query));

      if (index === -1) {
        return { deletedCount: 0 };
      }

      collection.splice(index, 1);
      database[collectionName] = collection;
      writeDb(database);

      return { deletedCount: 1 };
    }

    static async aggregate(pipeline = []) {
      if (typeof options.aggregate === "function") {
        const database = readDb();
        return options.aggregate({
          pipeline,
          collection: clone(database[collectionName] || []),
        });
      }

      throw new Error(`Aggregate is not implemented for ${collectionName}`);
    }
  };
}

module.exports = {
  createLocalModel,
  nowIso,
};
