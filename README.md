# OpenAuction

## Project Overview
OpenAuction is a full-stack, real-time auction platform designed to facilitate secure and dynamic online bidding. Built with the MERN stack (MongoDB, Express.js, React.js, Node.js) and integrated with Socket.io, the application ensures low-latency bidirectional communication for live auction updates. The platform features secure user authentication, comprehensive auction management, and real-time data visualization.

## Features
- **Real-Time Bidding Engine**: Utilizes WebSockets (Socket.io) to broadcast bids and update auction states instantaneously across all connected clients.
- **Secure Authentication & Authorization**: Implements stateless authentication using JSON Web Tokens (JWT) and bcrypt for password hashing to secure user data and restrict route access.
- **Auction & Asset Management**: Allows users to create and manage auction listings, utilizing Multer for robust multipart/form-data handling and image uploads.
- **Analytics Dashboard**: Integrates Chart.js to provide users with visual representations of auction metrics, bid histories, and market trends.
- **Automated Notifications**: Employs Nodemailer to dispatch timely email alerts regarding auction statuses, outbid notifications, and winning confirmations.
- **Responsive User Interface**: Delivers a seamless user experience across devices through a modern, responsive frontend built with React.js.

## Architecture Overview
OpenAuction follows a standard client-server architecture utilizing a RESTful API for standard CRUD operations and WebSockets for real-time events.
- **Client**: A React single-page application (SPA) that manages state and renders the UI. It communicates with the server via Axios for HTTP requests and Socket.io-client for real-time bid streams.
- **Server**: An Express.js application running on Node.js. It acts as the API gateway, handling authentication, business logic, file processing, and WebSocket connections.
- **Database**: A MongoDB NoSQL database, interfaced via Mongoose, providing a flexible schema for users, auctions, and bid histories.

## Tech Stack

### Frontend
- **Framework**: React.js
- **Routing**: React Router
- **Real-Time Communication**: Socket.io-client
- **Data Visualization**: Chart.js & react-chartjs-2
- **HTTP Client**: Axios

### Backend
- **Runtime & Framework**: Node.js, Express.js
- **Database & ODM**: MongoDB, Mongoose
- **Real-Time Communication**: Socket.io
- **Security**: JWT, bcryptjs
- **File Uploads**: Multer
- **Email Service**: Nodemailer

## Project Structure
```text
OpenAuction/
├── auction-frontend/    # React SPA, components, services, and state management
└── backend/             # Express API, controllers, models, and WebSocket logic
```

## Installation Guide

Follow these instructions to configure and run the project in a local development environment.

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas cluster)

### 1. Backend Setup
Navigate to the backend directory, install dependencies, and start the server:
```bash
cd backend
npm install
npm start
```

### 2. Frontend Setup
In a new terminal window, navigate to the frontend directory, install dependencies, and start the development server:
```bash
cd auction-frontend
npm install
npm start
```
The client application will run on `http://localhost:3000` and the API will listen on `http://localhost:5000` by default.

## Environment Variables

Create a `.env` file in the root of the `backend` directory and define the following variables:

```env
# Server Configuration
PORT=5000

# Database Configuration
MONGODB_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret_key

# Email Service Configuration
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

## API Overview
The backend provides a RESTful API alongside WebSocket events. Key resource endpoints include:
- **`POST /api/auth/register`**: Register a new user.
- **`POST /api/auth/login`**: Authenticate a user and issue a JWT.
- **`GET /api/auctions`**: Retrieve active auction listings.
- **`POST /api/auctions`**: Create a new auction (requires authentication).
- **`GET /api/auctions/:id`**: Retrieve details for a specific auction.
- **WebSocket Events**: `joinAuction`, `placeBid`, `bidUpdated`, `auctionEnded`.

## Future Improvements
- **Payment Gateway Integration**: Incorporate a service like Stripe to process secure transactions and hold bid deposits.
- **Advanced Search and Filtering**: Implement full-text search and category-based filtering for auction discovery.
- **Caching Layer**: Introduce Redis to cache active auction data and reduce database read loads during high-traffic events.
- **Containerization**: Provide Dockerfiles and a `docker-compose.yml` for streamlined deployment and environment consistency.
