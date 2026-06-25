# 🏷️ Auction Project

A full-stack, real-time auction platform built with the MERN stack (MongoDB, Express.js, React.js, Node.js) and Socket.io for live bidding.

## ✨ Features

- **User Authentication**: Secure signup and login using JWT and bcrypt.
- **Real-Time Bidding**: Live auction updates and bid placements using Socket.io.
- **Auction Management**: Create and manage auctions (with image uploads via Multer).
- **Dashboard & Analytics**: Visual data representation using Chart.js.
- **Email Notifications**: Automated email alerts for auction updates using Nodemailer.
- **Responsive Design**: Modern, responsive UI built with React.

## 🛠️ Tech Stack

### Frontend (`/auction-frontend`)
- **React.js** (UI Library)
- **React Router** (Navigation)
- **Socket.io-client** (Real-time WebSockets)
- **Chart.js & react-chartjs-2** (Data Visualization)
- **Axios** (HTTP requests)

### Backend (`/backend`)
- **Node.js & Express.js** (API and Server)
- **MongoDB & Mongoose** (Database & ODM)
- **Socket.io** (Real-time WebSockets)
- **JWT & bcryptjs** (Authentication & Security)
- **Multer** (File Uploads)
- **Nodemailer** (Email Services)

## 📁 Project Structure

```text
BTP/
├── auction-frontend/    # React Frontend application
└── backend/             # Node.js/Express Backend application
```

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/) installed
- [MongoDB](https://www.mongodb.com/) installed and running (locally or via MongoDB Atlas).

### 1. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory and configure your environment variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

Start the backend server:

```bash
npm start
```

### 2. Frontend Setup

Open a new terminal, navigate to the frontend directory, and install dependencies:

```bash
cd auction-frontend
npm install
```

Start the React development server:

```bash
npm start
```

The application should now be running on `http://localhost:3000` (by default) and the backend API on `http://localhost:5000`.

## 👤 Author

*This is my first self-made project!*
*I made this for practising Full stack web development.*
