# Chat App Frontend

A modern React chat application with Tailwind CSS and Capacitor Android packaging.

## Features

- **User Authentication**: Email OTP login flow
- **Real-time Messaging**: Socket.io for real-time message delivery
- **User List**: View all registered users
- **Message History**: Retrieve and display chat history
- **Responsive Design**: Beautiful UI with Tailwind CSS
- **Android Ready**: Capacitor shell, splash screen, hardware back handling, local notifications, and media capture shortcuts

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Socket.io Client
- Axios
- React Router

## Installation

1. Install dependencies:
```bash
npm install
```

2. Ensure your backend is running on `http://localhost:5000`

## Running the Frontend

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Android Commands

```bash
npm run build
npm run android:sync
```

```bash
npm run android:apk
```

```bash
npm run android:release
```

```bash
npm run android:aab
```

## Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/      # Reusable components
├── context/         # React context for auth
├── pages/           # Page components
├── services/        # API and Socket services
├── App.jsx          # Main app component
├── main.jsx         # Entry point
└── index.css        # Global styles
```

## Usage

1. Sign up or login with your credentials
2. Select a user from the sidebar
3. Start chatting in real-time
4. Messages are saved and can be retrieved anytime

## API Endpoints

- `POST /api/chat/signup` - Register new user
- `POST /api/chat/login` - Login user
- `GET /api/users` - Get all users
- `GET /api/chat/:user1/:user2` - Get messages between two users

## Socket Events

- `join` - Join user's room
- `sendMessage` - Send a message
- `receiveMessage` - Receive a message
