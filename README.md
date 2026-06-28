# Invoice Creation Backend

A secure, role-based REST API for managing the full *Vendor → Product → Purchase Order → Invoice* workflow. Built with Node.js, Express, and MongoDB, it handles authentication, inventory/stock control, a purchase-order approval workflow, partial invoicing with tax/discount rules, and an analytics endpoint for dashboards.

This is the backend API only and is designed to be paired with a frontend application (CORS is pre-configured for a React frontend origin).

## Features

  **Authentication & Authorization**
  - JWT-based auth using httpOnly cookies (and Bearer token support)
  - Signup, login, logout
  - Admin signup gated behind a secret key
  - Forgot/reset password via emailed, time-limited tokens
  - Change password while logged in
  - Role-based access control (`user` vs `admin`) on every protected route

  **Vendor Management**
  - Create, read, update, delete vendors
  - Users only see/manage their own vendors; admins see everything
  - Prevents deleting a vendor that still has purchase orders

  **Product & Inventory Management**
  - Create, read, update, delete products
  - Auto-generated SKUs
  - Tracks current `stock` vs `totalStock`, with an `ordered` virtual field
  - Per-product purchase history/tracking across all POs
  - Prevents deleting a product that's in use on an active PO

  **Purchase Orders**
  - Create POs with multiple line items, validated against live stock
  - Automatic stock deduction on creation, with rollback if stock runs out mid-request
  - Auto-incrementing PO numbers (`PO-0001`, `PO-0002`, ...)
  - Admin approval/rejection workflow that restores or re-deducts stock accordingly
  - 24-hour edit window for pending POs (with stock reconciliation on edit)
  - Optional automated HTML email notification to the vendor on creation

  **Invoices**
  - Generate invoices directly from approved purchase orders
  - *Partial / Split invoicing* — tracks invoiced quantity per line item so a single PO can be billed across multiple invoices until fully closed
  - Configurable discount and tax rules (percentage or fixed amount)
  - File attachments (images/PDFs, up to 5 files, 5MB each) via Multer
  - Invoice status lifecycle: `unpaid` → `paid` / `cancelled`
  - Access scoped so users only see invoices tied to their own POs

  **Analytics Dashboard**
  - Single endpoint returning total revenue, total PO value, counts (POs/invoices/vendors/products/users), pending invoices, and an invoice-status breakdown for charts
  - Built with parallelized MongoDB aggregation pipelines
  - Scoped per-user for regular users, global for admins

  **Engineering**
  - Reusable query-builder utility for filtering, search, sorting, field limiting, and pagination — shared across all list endpoints
  - Centralized error handling (`AppError` + `catchAsync`) with a global error middleware that cleanly formats Mongoose, JWT, and Multer errors
  - Security middleware: Helmet, scoped CORS with credentials, httpOnly/sameSite cookies, bcrypt password hashing

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | MongoDB with Mongoose |
| Auth | JSON Web Tokens (JWT), bcrypt |
| File Uploads | Multer |
| Email | Nodemailer |
| Validation | validator.js |
| Security | Helmet, CORS, cookie-parser |

## Project Structure

```
.
├── app.js                  # Express app, middleware, route mounting
├── server.js                # Entry point, DB connection, server startup
├── controllers/
│   ├── authController.js    # Signup, login, password reset, route protection
│   ├── errorController.js   # Global error handler
│   ├── invoiceController.js # Invoice creation, partial billing, status, deletion
│   ├── poController.js      # Purchase order CRUD + approval workflow
│   ├── productController.js # Product/inventory CRUD + tracking
│   ├── statsController.js   # Dashboard analytics aggregation
│   └── vendorController.js  # Vendor CRUD
├── models/
│   ├── counterModel.js      # Auto-incrementing sequence for PO/invoice numbers
│   ├── invoiceModel.js
│   ├── poModel.js
│   ├── productModel.js
│   ├── userModel.js
│   └── vendorModel.js
├── routes/
│   ├── authRouter.js
│   ├── invoiceRouter.js
│   ├── poRouter.js
│   ├── productRouter.js
│   ├── statsRouter.js
│   └── vendorRouter.js
└── utils/
    ├── appError.js           # Custom operational error class
    ├── applyApiFeatures.js   # Filter/search/sort/paginate query builder
    ├── catchAsync.js         # Async error wrapper for controllers
    ├── email.js              # Nodemailer transport + send helper
    ├── generateToken.js      # JWT creation + cookie config
    ├── getCounterNumber.js   # PO/invoice number generator
    └── multer.js             # File upload config (type/size limits)
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- A MongoDB instance (local or Atlas)
- A Gmail account (or other SMTP provider) for sending emails via Nodemailer

### Installation

```bash
git clone https://github.com/M-Subhaaan/Invoice-Creation-Backend.git
cd Invoice-Creation-Backend
npm install
```

### Environment Variables

Copy `empty.env` to `.env` and fill in the values:

```env
NODE_ENV=development
PORT=5000
MONGO_DB_URL=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret
JWT_SECRET_EXPIRES_IN=90d
COOKIE_EXPIRES=90

ADMIN_SECRET_KEY=your_admin_signup_secret

EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_email_app_password
FRONTEND_URL=http://localhost:3000
```

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` (controls error verbosity & cookie security) |
| `PORT` | Port the server listens on |
| `MONGO_DB_URL` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_SECRET_EXPIRES_IN` | JWT expiry (e.g. `90d`) |
| `COOKIE_EXPIRES` | Cookie expiry in days |
| `ADMIN_SECRET_KEY` | Required key to register an admin account |
| `EMAIL_USERNAME` / `EMAIL_PASSWORD` | Gmail credentials used by Nodemailer |
| `FRONTEND_URL` | Allowed CORS origin (your frontend app) and base URL used in password-reset emails |

### Running the Server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:<PORT>/api/v1`.

## API Reference

All routes except signup/login/forgot-password are protected and require a valid JWT (sent as a cookie or `Authorization: Bearer <token>` header). Routes marked **Admin** are restricted to the `admin` role.

### Auth — `/api/v1/users`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/signup` | Register a new user |
| POST | `/admin/signup` | Register a new admin (requires `secretKey`) |
| POST | `/login` | Log in and receive a JWT |
| POST | `/forgetpassword` | Request a password reset email |
| PATCH | `/resetpassword/:token` | Reset password using emailed token |
| PATCH | `/updatepassword` | Change password while logged in |
| POST | `/logout` | Log out (clears auth cookie) |
| GET | `/` | List all users **(Admin)** |
| DELETE | `/deleteuser/:id` | Delete a user **(Admin)** |

### Vendors — `/api/v1/vendors`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List vendors (own vendors for users, all for admins) |
| GET | `/:id` | Get a single vendor |
| POST | `/` | Create a vendor |
| PATCH | `/:id` | Update a vendor |
| DELETE | `/:id` | Delete a vendor **(Admin)** |

### Products — `/api/v1/products`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List products |
| GET | `/tracking` | Get purchase history for a specific product across all POs |
| GET | `/:id` | Get a single product |
| POST | `/` | Create a product **(Admin)** |
| PATCH | `/:id` | Update a product **(Admin)** |
| DELETE | `/:id` | Delete a product **(Admin)** |

### Purchase Orders — `/api/v1/purchase-orders`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List purchase orders |
| GET | `/pos/invoices` | List POs with their related invoices |
| GET | `/opened/pos` | List POs still open for invoicing |
| GET | `/:id` | Get a single PO |
| POST | `/` | Create a PO (validates & deducts stock) |
| PATCH | `/:id` | Approve or reject a PO **(Admin)** |
| PATCH | `/user-update/:id` | Edit a pending PO (within 24 hours of creation) |
| DELETE | `/:id` | Delete a PO **(Admin)** |

### Invoices — `/api/v1/invoices`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List invoices |
| GET | `/:id` | Get a single invoice |
| POST | `/` | Create an invoice from an approved PO (supports file attachments) |
| PATCH | `/:id` | Update invoice status (unpaid/paid/cancelled) **(Admin)** |
| DELETE | `/:id` | Delete an invoice **(Admin)** |

### Analytics — `/api/v1/stats`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Dashboard stats: revenue, PO value, counts, invoice status breakdown |

## Query Features

All list (`GET /`) endpoints support a shared set of query parameters:

- **Filtering**: `?status=approved`, `?price[gte]=100`
- **Search**: `?search=acme`
- **Sorting**: `?sort=-createdAt,name`
- **Field limiting**: `?fields=name,email`
- **Pagination**: `?page=2&limit=10`

## Error Handling

Errors are returned as JSON in a consistent shape:

```json
{
  "status": "fail",
  "message": "Insufficient stock for \"Widget\"."
}
```

In development mode, responses include the full stack trace. In production, only operational errors expose their message; unexpected errors return a generic 500 response.

## License

ISC

## Author

M Subhan
