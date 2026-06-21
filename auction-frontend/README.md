# Online Auction System Frontend

A simple React.js frontend for an online auction system.

## Features

- User authentication (register/login)
- View active auctions
- Participate in auctions (join, bid)
- Seller dashboard to create and manage auctions

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm start
   ```

3. The app will run on http://localhost:3000

## API Endpoints

The frontend expects a backend API running on http://localhost:3001 with the following endpoints:

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auctions
- GET /api/auctions/:id
- POST /api/auctions
- POST /api/join
- POST /api/bid
- POST /api/extend

## Project Structure

```
src/
├── components/
│   ├── AuctionCard.js
│   ├── AuctionForm.js
│   └── BidHistory.js
├── pages/
│   ├── AuthPage.js
│   ├── HomePage.js
│   ├── AuctionDetailPage.js
│   └── SellerDashboard.js
├── services/
│   ├── api.js
│   └── auth.js
├── App.js
├── App.css
├── index.js
└── index.css
```

## Notes

- JWT token is stored in localStorage
- Basic inline styling used for simplicity
- No real-time features implemented