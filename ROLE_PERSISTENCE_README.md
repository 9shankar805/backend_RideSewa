# Role Persistence Backend Updates

## New Features Added

### 1. User Role Update Endpoint
- **Route**: `PUT /auth/update-role`
- **Purpose**: Allows authenticated users to switch between passenger and driver roles
- **Authentication**: Requires JWT token
- **Body**: `{ "user_type": "passenger" | "driver" | "both" }`

### 2. Database Schema Updates
- Added `password_hash` field to `users` table for email/password authentication
- Added `otp_verifications` table for phone number verification
- Added email index for faster lookups

### 3. Migration Script
- `migrate-role-persistence.js` - Safely adds new fields to existing databases
- Can be run multiple times without issues (uses IF NOT EXISTS)

## Deployment

### For Render:
1. The migration runs automatically on deployment
2. Use `deploy-with-migration.sh` as the start command
3. Or run `node migrate-role-persistence.js` manually before starting the server

### For Local Development:
```bash
node migrate-role-persistence.js
npm start
```

## API Usage

### Update User Role
```javascript
PUT /auth/update-role
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_type": "driver"
}
```

### Response
```javascript
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "User Name",
    "phone_number": "+977-9800000000",
    "user_type": "driver",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## Frontend Integration

The frontend AuthContext automatically syncs role changes with this endpoint when `setUserRole()` is called and the user is authenticated.

## Database Changes

### Users Table
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### OTP Verifications Table
```sql
CREATE TABLE IF NOT EXISTS otp_verifications (
  phone_number VARCHAR(20) PRIMARY KEY,
  otp VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```