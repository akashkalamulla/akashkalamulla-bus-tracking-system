# 🚌 Bus Tracking API - Complete Postman Guide for Beginners

This guide will teach you how to test ALL admin operations using Postman step by step. Even if you've never used Postman before, you'll be able to follow along!

## 📋 What You Need
- ✅ Postman installed (download from [postman.com](https://www.postman.com/downloads/))
- ✅ Your API Base URL: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev`
- ✅ An admin account (we'll create one first!)

---

## 🎯 Step 1: Setting Up Postman

### Download and Install Postman
1. Go to [postman.com](https://www.postman.com/downloads/)
2. Download Postman for your computer
3. Install and open it
4. Create a free account (optional but recommended)

### Create a New Collection
1. Click the **"+"** button next to "Collections"
2. Name it: **"Bus Tracking Admin API"**
3. Click **"Create"**

---

## 🔐 Step 2: Create Your Admin Account

Let's start by creating an admin user account!

### Request 1: Register Admin User

1. **Right-click** your collection → **"Add Request"**
2. **Name**: `1. Register Admin User`
3. **Method**: Change from GET to **POST**
4. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/register`

#### Headers Tab:
Click **"Headers"** tab and add:
```
Key: Content-Type
Value: application/json
```

#### Body Tab:
1. Click **"Body"** tab
2. Select **"raw"**
3. Select **"JSON"** from dropdown
4. Copy and paste this:

```json
{
  "username": "admin_test",
  "password": "AdminPass123!",
  "email": "admin@test.com",
  "role": "NTC",
  "name": "Test Administrator"
}
```

5. Click **"Send"** button

**Expected Response**: You should get a success message saying the admin user was created!

---

## 🔑 Step 3: Login and Get Your Access Token

Now let's login to get the special "token" that proves you're an admin.

### Request 2: Login Admin User

1. **Right-click** your collection → **"Add Request"**
2. **Name**: `2. Login Admin User`
3. **Method**: **POST**
4. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/login`

#### Headers Tab:
```
Key: Content-Type
Value: application/json
```

#### Body Tab:
```json
{
  "username": "admin_test",
  "password": "AdminPass123!"
}
```

5. Click **"Send"**

**Important**: In the response, you'll see something like:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

**Copy the token value** - you'll need it for ALL admin operations!

---

## 🏗️ Step 4: Admin Route Management

Now let's test all the route management features. You'll use your token for each request.

### Request 3: Get All Routes (Admin View)

1. **Add Request**: `3. Get All Routes (Admin)`
2. **Method**: **GET**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/routes`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```
*Replace YOUR_TOKEN_HERE with the token you copied from login*

#### No Body needed for GET requests

5. Click **"Send"**

### Request 4: Create New Route

1. **Add Request**: `4. Create New Route`
2. **Method**: **POST**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/routes`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE

Key: Content-Type
Value: application/json
```

#### Body Tab:
```json
{
  "route_name": "Colombo to Kandy Express",
  "start_location": "Colombo Fort",
  "end_location": "Kandy Central",
  "description": "Direct express service between Colombo and Kandy",
  "total_stops": 15,
  "distance_km": 116,
  "estimated_duration_minutes": 180,
  "fare_rs": 450,
  "route_type": "express",
  "status": "ACTIVE",
  "service_frequency": "Every 30 minutes",
  "first_departure": "05:00",
  "last_departure": "20:00",
  "operates_on": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  "intermediate_stops": [
    "Kelaniya",
    "Gampaha",
    "Veyangoda",
    "Mirigama",
    "Polgahawela",
    "Kurunegala",
    "Dambulla",
    "Matale"
  ],
  "from_city": "Colombo",
  "to_city": "Kandy"
}
```

5. Click **"Send"**

**Expected Response**: You should get the newly created route with a RouteID!

### Request 5: Get Specific Route

1. **Add Request**: `5. Get Specific Route`
2. **Method**: **GET**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/routes/ROUTE_ID_HERE`

*Replace ROUTE_ID_HERE with the RouteID from the previous response*

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

### Request 6: Update Route

1. **Add Request**: `6. Update Route`
2. **Method**: **PUT**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/routes/ROUTE_ID_HERE`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE

Key: Content-Type
Value: application/json
```

#### Body Tab:
```json
{
  "fare_rs": 500,
  "service_frequency": "Every 20 minutes",
  "status": "ACTIVE"
}
```

5. Click **"Send"**

### Request 7: Delete Route

1. **Add Request**: `7. Delete Route`
2. **Method**: **DELETE**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/routes/ROUTE_ID_HERE`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

---

## 🚌 Step 5: Admin Bus Management

### Request 8: Get All Buses

1. **Add Request**: `8. Get All Buses (Admin)`
2. **Method**: **GET**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/buses`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

### Request 9: Create New Bus

1. **Add Request**: `9. Create New Bus`
2. **Method**: **POST**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/buses`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE

Key: Content-Type
Value: application/json
```

#### Body Tab:
```json
{
  "busNumber": "NB-1234",
  "capacity": 50,
  "busType": "Standard",
  "operatorId": "SLTB",
  "status": "ACTIVE",
  "routeId": "route_123",
  "driverName": "John Silva",
  "driverContact": "+94771234567",
  "registrationNumber": "WP CAB-1234",
  "manufactureYear": 2020,
  "fuelType": "Diesel",
  "amenities": ["AC", "WiFi", "GPS"]
}
```

5. Click **"Send"**

### Request 10: Update Bus

1. **Add Request**: `10. Update Bus`
2. **Method**: **PUT**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/buses/BUS_ID_HERE`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE

Key: Content-Type
Value: application/json
```

#### Body Tab:
```json
{
  "status": "MAINTENANCE",
  "driverName": "Peter Fernando",
  "driverContact": "+94771234999"
}
```

5. Click **"Send"**

### Request 11: Delete Bus

1. **Add Request**: `11. Delete Bus`
2. **Method**: **DELETE**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/buses/BUS_ID_HERE`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

---

## 📊 Step 6: Admin Analytics & History

### Request 12: Get Location History

1. **Add Request**: `12. Get Location History`
2. **Method**: **GET**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/history`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

### Request 13: Get Specific Bus History

1. **Add Request**: `13. Get Bus History`
2. **Method**: **GET**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/admin/history/BUS_ID_HERE`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

---

## 🔄 Step 7: Authentication Management

### Request 14: Get User Profile

1. **Add Request**: `14. Get User Profile`
2. **Method**: **GET**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/profile`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

### Request 15: Refresh Token

1. **Add Request**: `15. Refresh Token`
2. **Method**: **POST**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/refresh`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

### Request 16: Logout

1. **Add Request**: `16. Logout`
2. **Method**: **POST**
3. **URL**: `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev/auth/logout`

#### Headers Tab:
```
Key: Authorization
Value: Bearer YOUR_TOKEN_HERE
```

5. Click **"Send"**

---

## 🎯 Quick Testing Checklist

Follow this order to test everything:

### ✅ Authentication Flow:
1. ✅ Register Admin User
2. ✅ Login Admin User (get token)
3. ✅ Get User Profile
4. ✅ Refresh Token (optional)

### ✅ Route Management:
5. ✅ Get All Routes
6. ✅ Create New Route (save the RouteID)
7. ✅ Get Specific Route
8. ✅ Update Route
9. ✅ Delete Route (optional)

### ✅ Bus Management:
10. ✅ Get All Buses
11. ✅ Create New Bus (save the BusID)
12. ✅ Update Bus
13. ✅ Delete Bus (optional)

### ✅ Analytics:
14. ✅ Get Location History
15. ✅ Get Bus History

### ✅ Cleanup:
16. ✅ Logout

---

## 🚨 Common Issues & Solutions

### Issue 1: "Unauthorized" Error
**Solution**: Make sure you're using the correct token in the Authorization header:
```
Authorization: Bearer YOUR_ACTUAL_TOKEN
```

### Issue 2: "Invalid JSON" Error
**Solution**: 
1. Check that Content-Type is `application/json`
2. Validate your JSON at [jsonlint.com](https://jsonlint.com/)

### Issue 3: "Route not found" Error
**Solution**: Make sure you're using the correct RouteID from the create route response

### Issue 4: Token Expired
**Solution**: Login again to get a fresh token, or use the refresh token endpoint

### Issue 5: "Access denied" Error
**Solution**: Make sure your user role is "NTC" (admin role)

---

## 💡 Pro Tips

1. **Save Your Token**: Copy your login token to a text file so you can reuse it
2. **Use Variables**: In Postman, you can create variables for your base URL and token
3. **Organize**: Keep your requests in the order you'll use them
4. **Test Data**: Use realistic Sri Lankan city names and bus numbers
5. **Check Responses**: Always read the response to see if your request worked

---

## 🎉 Congratulations!

You now know how to test all admin operations in the Bus Tracking API! You can:
- ✅ Create and manage admin accounts
- ✅ Manage routes (create, read, update, delete)
- ✅ Manage buses (create, read, update, delete)
- ✅ View analytics and history
- ✅ Handle authentication properly

Remember: Always start with authentication (register/login) before testing other endpoints!