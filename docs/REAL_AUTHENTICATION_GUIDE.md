# 🔐 Real Authentication System - Production Ready

## 🎯 **What's Been Implemented**

### ✅ **Authentication Endpoints:**
- **POST** `/auth/register` - User registration
- **POST** `/auth/login` - User login (get JWT token)
- **POST** `/auth/refresh` - Refresh expired token
- **GET** `/auth/profile` - Get user profile (requires JWT)
- **POST** `/auth/logout` - User logout

### ✅ **Database:**
- **Users Table** in DynamoDB with email/username indexes
- **Secure password hashing** with bcrypt (12 salt rounds)
- **Role-based user system** (NTC, BUS_OPERATOR, COMMUTER)

### ✅ **Security Features:**
- **JWT tokens** generated after successful login
- **Password validation** (minimum 8 characters)
- **User account status** (active/inactive)
- **Operator ID auto-generation** for BUS_OPERATOR role

## 📋 **API Endpoints**

### **Base URL:** `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev`

---

## 🔓 **1. User Registration**
**POST** `/auth/register`

### Request Body:
```json
{
  "username": "john_admin",
  "password": "SecurePass123!",
  "email": "john@ntc.gov.lk",
  "role": "NTC",
  "name": "John Administrator"
}
```

### Roles Available:
- **`NTC`** - National Transport Commission (Admin)
- **`BUS_OPERATOR`** - Bus operators 
- **`COMMUTER`** - Regular users

### Success Response (201):
```json
{
  "message": "User registered successfully",
  "user": {
    "userId": "uuid-generated",
    "username": "john_admin",
    "email": "john@ntc.gov.lk",
    "role": "NTC",
    "name": "John Administrator",
    "isActive": true,
    "createdAt": "2025-10-11T10:00:00.000Z"
  }
}
```

---

## 🔑 **2. User Login (Get Token)**
**POST** `/auth/login`

### Request Body:
```json
{
  "username": "john_admin",
  "password": "SecurePass123!"
}
```

### Success Response (200):
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "uuid-here",
    "username": "john_admin",
    "email": "john@ntc.gov.lk",
    "role": "NTC",
    "name": "John Administrator"
  }
}
```

**💡 Use this token for all protected API calls!**

---

## 🔄 **3. Token Refresh**
**POST** `/auth/refresh`

### Headers:
```
Authorization: Bearer YOUR_CURRENT_TOKEN
```

### Success Response (200):
```json
{
  "message": "Token refreshed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 👤 **4. Get User Profile**
**GET** `/auth/profile`

### Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Success Response (200):
```json
{
  "user": {
    "userId": "uuid-here",
    "username": "john_admin",
    "email": "john@ntc.gov.lk",
    "role": "NTC",
    "name": "John Administrator",
    "isActive": true,
    "createdAt": "2025-10-11T10:00:00.000Z",
    "lastLoginAt": "2025-10-11T15:30:00.000Z"
  }
}
```

---

## 🚪 **5. Logout**
**POST** `/auth/logout`

### Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Success Response (200):
```json
{
  "message": "Logged out successfully"
}
```

---

## 🧪 **Testing the Authentication System**

### **Step 1: Register Test Users**

#### Admin User:
```bash
curl -X POST https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_test",
    "password": "AdminPass123!",
    "email": "admin@test.com",
    "role": "NTC", 
    "name": "Test Administrator"
  }'
```

#### Bus Operator:
```bash
curl -X POST https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "operator_test",
    "password": "OperatorPass123!",
    "email": "operator@test.com",
    "role": "BUS_OPERATOR",
    "name": "Test Operator"
  }'
```

#### Commuter:
```bash
curl -X POST https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "commuter_test", 
    "password": "CommuterPass123!",
    "email": "commuter@test.com",
    "role": "COMMUTER",
    "name": "Test Commuter"
  }'
```

### **Step 2: Login to Get Tokens**

```bash
# Login as admin
curl -X POST https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_test",
    "password": "AdminPass123!"
  }'
```

**Copy the token from the response!**

### **Step 3: Use Token for Protected Endpoints**

```bash
# Get admin routes (replace YOUR_TOKEN with actual token)
curl -X GET https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/routes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## 🔒 **Security Features**

### **Password Security:**
- ✅ Minimum 8 characters required
- ✅ Hashed with bcrypt (12 salt rounds)
- ✅ Never stored or returned in plain text

### **JWT Token Security:**
- ✅ 24-hour expiration (configurable)
- ✅ Contains user role for authorization
- ✅ Signed with secret key
- ✅ Can be refreshed before expiry

### **Account Security:**
- ✅ Username uniqueness enforced
- ✅ Email uniqueness via index
- ✅ Account active/inactive status
- ✅ Last login tracking

### **API Security:**
- ✅ Rate limiting on auth endpoints
- ✅ CORS enabled for web apps
- ✅ Input validation and sanitization
- ✅ Proper error messages (no info leakage)

---

## 🔄 **Migration from Test System**

### **Before (Testing):**
```javascript
// Pre-generated tokens
const adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

### **After (Production):**
```javascript
// 1. User registers
const registerResponse = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'securepass',
    email: 'admin@company.com',
    role: 'NTC',
    name: 'Administrator'
  })
});

// 2. User logs in to get token
const loginResponse = await fetch('/auth/login', {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'securepass'
  })
});

const { token } = await loginResponse.json();

// 3. Use token for API calls
const dataResponse = await fetch('/admin/routes', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-API-Key': 'your-api-key'
  }
});
```

---

## 🎉 **System Benefits**

### **✅ Production Ready:**
- Real user accounts with secure passwords
- Token-based authentication
- Role-based authorization
- Account management

### **✅ Scalable:**
- DynamoDB backend for millions of users
- JWT stateless authentication
- Index-based lookups for performance
- Configurable token expiration

### **✅ Secure:**
- Industry-standard password hashing
- JWT token security
- Input validation
- No hardcoded credentials

### **✅ User-Friendly:**
- Simple registration process
- Token refresh capability
- Profile management
- Clear error messages

---

## 📞 **Support**

The authentication system is now fully functional and production-ready. Users can:

1. **Register** with username, password, email, role, and name
2. **Login** to receive JWT tokens
3. **Access protected APIs** using tokens + API keys
4. **Refresh tokens** before expiry
5. **Manage profiles** and logout

All the previous test tokens are no longer needed - users now get real tokens through the login process! 🚀