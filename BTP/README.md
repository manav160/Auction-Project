# OpenAuction

OpenAuction is a real-time auction platform built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.io. It allows users to browse items, place live bids, and manage their own auctions. 

## Features

- **Real-Time Bidding**: Bids are updated live across all connected clients using WebSockets (Socket.io).
- **User Authentication**: Secure signup and login using JWT and bcrypt for password hashing.
- **Auction Creation**: Users can create auctions and upload item images (handled via Multer).
- **Dashboard**: Includes a visual dashboard using Chart.js to track auction data and bid history.
- **Email Alerts**: Automated email notifications sent via Nodemailer for outbid alerts and winning confirmations.
- **Responsive UI**: The frontend is built with React and designed to work across desktop and mobile devices.

## Tech Stack

**Frontend:**
- React.js
- React Router
- Socket.io-client
- Chart.js & react-chartjs-2
- Axios

**Backend:**
- Node.js & Express.js
- MongoDB with Mongoose
- Socket.io
- JWT & bcryptjs
- Multer
- Nodemailer

## Project Structure

```text
OpenAuction/
├── auction-frontend/    # React frontend
└── backend/             # Node.js/Express API
```

## Running the Project Locally

To get a local copy up and running, follow these steps.

### Prerequisites

- [Node.js](https://nodejs.org/) installed
- [MongoDB](https://www.mongodb.com/) running locally or a MongoDB Atlas URI

### 1. Start the Backend

Open a terminal and navigate to the `backend` folder:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory and add your environment variables:

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

### 2. Start the Frontend

Open a new terminal window and navigate to the `auction-frontend` folder:

```bash
cd auction-frontend
npm install
```

Start the React development server:

```bash
npm start
```

The app should now be running at `http://localhost:3000` and the API at `http://localhost:5000`.

## API Overview

Here are some of the core endpoints used in the application:

- `POST /api/auth/register` - Create a new user account
- `POST /api/auth/login` - Authenticate user and get JWT
- `GET /api/auctions` - Fetch all active auctions
- `POST /api/auctions` - Create a new auction
- `GET /api/auctions/:id` - Get details of a single auction

**Socket Events:**
- `joinAuction`: Connects a user to a specific auction room.
- `placeBid`: Emitted when a user submits a new bid.
- `bidUpdated`: Broadcasts the new highest bid to all users in the room.

## Future Improvements

- Add Stripe integration for handling actual payments and deposits.
- Implement search functionality and category filters for easier browsing.
- Write unit tests for the core bidding logic and API endpoints.
