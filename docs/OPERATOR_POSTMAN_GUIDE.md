# 🚌 Bus Operator Postman Testing Guide

**Complete step-by-step guide for creating a Postman collection and manually testing all Bus Operator endpoints**

---

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Creating Postman Collection](#creating-postman-collection)
- [Authentication Setup](#authentication-setup)
- [Environment Configuration](#environment-configuration)
- [Manual API Testing Guide](#manual-api-testing-guide)
- [Operator Endpoints Testing](#operator-endpoints-testing)
- [Common Error Solutions](#common-error-solutions)
- [Testing Scenarios](#testing-scenarios)

---

## 🔧 Prerequisites

### What You Need:
1. **Postman Application** - Download from [postman.com](https://www.postman.com/)
2. **Valid BUS_OPERATOR Account** - Created through registration
3. **JWT Token** - Obtained from login endpoint
4. **API Base URL** - `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev`

---

## 📁 Creating Postman Collection

### Step 1: Create New Collection
1. **Open Postman** application
2. **Click "New"** button in the top left
3. **Select "Collection"** from the dropdown
4. **Name your collection**: `Bus Operator API Testing`
5. **Add description**: `Complete testing suite for Bus Operator endpoints`
6. **Click "Create"**

### Step 2: Create Folder Structure
Right-click on your collection and create these folders:

```
🚌 Bus Operator API Testing
├── 📋 Setup & Authentication
├── 🚍 Bus Management
└── 📍 Location Management
```

**To create folders:**
1. Right-click on collection name
2. Select "Add Folder"
3. Name the folder
4. Repeat for each folder

### Step 3: Set Collection Variables
1. **Click on your collection name**
2. **Go to "Variables" tab**
3. **Add these variables:**

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `baseUrl` | `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev` | `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev` |
| `authToken` | `Bearer ` | `Bearer ` |
| `operatorId` | `OP1760242081118` | `OP1760242081118` |
| `testBusId` | `BUS_001` | `BUS_001` |

4. **Click "Save"**

---

## 🔐 Authentication Setup

### Step 1: Create Operator Account
```http
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "username": "operator123",
  "password": "securepass123",
  "email": "operator@buscompany.com",
  "role": "BUS_OPERATOR",
  "name": "John Bus Driver"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "user_12345",
    "username": "operator123",
    "role": "BUS_OPERATOR"
  }
}
```

### Step 2: Login to Get JWT Token
```http
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "username": "operator123",
  "password": "securepass123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "user_12345",
      "username": "operator123",
      "role": "BUS_OPERATOR",
      "name": "John Bus Driver"
    }
  }
}
```

**📝 Important:** Copy the `token` value - you'll need it for all operator endpoints!

---

## ⚙️ Environment Configuration

### Option 1: Using Collection Variables (Recommended)
We already set up collection variables in Step 3 above. This keeps everything in one place.

### Option 2: Create Separate Environment (Optional)
If you want to test multiple environments (dev/staging/prod):

1. **Click gear icon** (⚙️) in top right
2. **Select "Manage Environments"**
3. **Click "Add"**
4. **Name**: `Bus API - Dev`
5. **Add Variables:**

| Variable Name | Value |
|---------------|-------|
| `baseUrl` | `https://zcmux4xvg0.execute-api.ap-south-1.amazonaws.com/dev` |
| `authToken` | `Bearer ` |
| `operatorId` | `OP1760242081118` |
| `testBusId` | `BUS_001` |

6. **Click "Add"** then select the environment from dropdown

---

## 🧪 Manual API Testing Guide

### Phase 1: Setup Authentication Requests

#### 1.1 Create Register Request
**Inside "Setup & Authentication" folder:**

1. **Click "Add Request"**
2. **Name**: `1. Register Operator`
3. **Method**: `POST`
4. **URL**: `{{baseUrl}}/auth/register`
5. **Headers tab**: Add `Content-Type: application/json`
6. **Body tab**: Select "raw" and "JSON", then add:

```json
{
  "username": "testoperator123",
  "password": "securepass123",
  "email": "testop@buscompany.com",
  "role": "BUS_OPERATOR",
  "name": "Test Operator"
}
```

7. **Tests tab**: Add this script to validate response:
```javascript
pm.test("Registration successful", function () {
    pm.response.to.have.status(201);
    pm.expect(pm.response.json()).to.have.property('success', true);
});
```

8. **Click "Save"**

#### 1.2 Create Login Request
1. **Click "Add Request"**
2. **Name**: `2. Login Operator`
3. **Method**: `POST`
4. **URL**: `{{baseUrl}}/auth/login`
5. **Headers**: `Content-Type: application/json`
6. **Body** (raw JSON):

```json
{
  "username": "testoperator123",
  "password": "securepass123"
}
```

7. **Tests tab**: Add this script to save the token:
```javascript
pm.test("Login successful", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response).to.have.property('success', true);
    
    // Save token for other requests
    if (response.data && response.data.token) {
        pm.collectionVariables.set("authToken", "Bearer " + response.data.token);
        console.log("Token saved: " + response.data.token);
    }
});
```

8. **Save the request**

### Phase 2: Test Authentication Flow

#### 2.1 Manual Testing Steps:
1. **Run Register request:**
   - Click "Send" button
   - **Expected**: Status 201, success: true
   - **Note**: If user exists, you'll get 400 error (this is normal)

2. **Run Login request:**
   - Click "Send" button
   - **Expected**: Status 200, success: true, token in response
   - **Check**: Collection variables should now have the auth token

3. **Verify token was saved:**
   - Go to collection → Variables tab
   - Check that `authToken` now has "Bearer ey..." value

### Phase 3: Create Bus Management Requests

#### 3.1 Get All Buses Request
**Inside "Bus Management" folder:**

1. **Add Request**: `1. Get All Buses`
2. **Method**: `GET`
3. **URL**: `{{baseUrl}}/operator/buses`
4. **Authorization tab**: 
   - Type: "Bearer Token"
   - Token: `{{authToken}}`
5. **Tests**:
```javascript
pm.test("Get buses successful", function () {
    pm.response.to.have.status(200);
    pm.expect(pm.response.json()).to.have.property('success', true);
});
```

#### 3.2 Create Bus Request
1. **Add Request**: `2. Create New Bus`
2. **Method**: `POST`
3. **URL**: `{{baseUrl}}/operator/buses`
4. **Authorization**: Bearer Token `{{authToken}}`
5. **Headers**: `Content-Type: application/json`
6. **Body**:
```json
{
  "busNumber": "TEST-{{$randomInt}}",
  "capacity": 40,
  "routeId": "R001",
  "status": "ACTIVE",
  "model": "Test Bus Model",
  "year": 2024
}
```

7. **Tests** (to save bus ID):
```javascript
pm.test("Bus created successfully", function () {
    pm.response.to.have.status(201);
    const response = pm.response.json();
    pm.expect(response).to.have.property('success', true);
    
    // Save bus ID for future requests
    if (response.BusID) {
        pm.collectionVariables.set("testBusId", response.BusID);
        console.log("Bus ID saved: " + response.BusID);
    }
});
```

#### 3.3 Get Specific Bus Request
1. **Add Request**: `3. Get Bus Details`
2. **Method**: `GET`
3. **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}`
4. **Authorization**: Bearer Token `{{authToken}}`

#### 3.4 Update Bus Request
1. **Add Request**: `4. Update Bus`
2. **Method**: `PUT`
3. **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}`
4. **Authorization**: Bearer Token `{{authToken}}`
5. **Body**:
```json
{
  "capacity": 50,
  "status": "MAINTENANCE"
}
```

#### 3.5 Delete Bus Request
1. **Add Request**: `5. Delete Bus`
2. **Method**: `DELETE`
3. **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}`
4. **Authorization**: Bearer Token `{{authToken}}`

### Phase 4: Create Location Management Requests

#### 4.1 Update Location Request
**Inside "Location Management" folder:**

1. **Add Request**: `1. Update Bus Location`
2. **Method**: `PUT`
3. **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}/location`
4. **Authorization**: Bearer Token `{{authToken}}`
5. **Body**:
```json
{
  "latitude": 6.9271,
  "longitude": 79.8612,
  "speed": 45.5,
  "heading": 180,
  "timestamp": "{{$isoTimestamp}}"
}
```

#### 4.2 Get Location Request
1. **Add Request**: `2. Get Bus Location`
2. **Method**: `GET`
3. **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}/location`
4. **Authorization**: Bearer Token `{{authToken}}`

### Phase 5: Manual Testing Workflow

#### Complete Testing Sequence:
Follow this exact order for manual testing:

**🔐 Step 1: Authentication**
1. Run "Register Operator" (if first time)
2. Run "Login Operator" ✅ **Must succeed**
3. Verify token is saved in variables

**🚍 Step 2: Bus Management**
4. Run "Get All Buses" ✅ **Should return empty array initially**
5. Run "Create New Bus" ✅ **Must succeed**
6. Run "Get Bus Details" ✅ **Should return the created bus**
7. Run "Update Bus" ✅ **Should modify bus details**
8. Run "Get Bus Details" again ✅ **Verify changes**

**📍 Step 3: Location Management**
9. Run "Update Bus Location" ✅ **Should succeed**
10. Run "Get Bus Location" ✅ **Should return updated location**

**🗑️ Step 4: Cleanup**
11. Run "Delete Bus" ✅ **Should succeed**
12. Run "Get All Buses" ✅ **Should return empty array**

#### Manual Verification Checklist:
For each request, manually check:
- ✅ **Status Code**: 200/201 for success
- ✅ **Response Body**: Contains `"success": true`
- ✅ **Headers**: `Content-Type: application/json`
- ✅ **Time**: Response time under 3000ms
- ✅ **Data**: Expected data structure in response

---

## 🚍 Operator Endpoints Testing

### Manual Testing Results Verification

After setting up your collection, test each endpoint and record results:

### 1. 📋 Get All Operator Buses
**Request Setup:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/operator/buses`
- **Authorization**: `Bearer {{authToken}}`

**Manual Test Steps:**
1. Click "Send" button
2. **Check Status Code**: Should be `200`
3. **Verify Response Structure**:

```json
{
  "success": true,
  "data": [
    {
      "BusID": "bus_1760243196373_yxn28nw96",
      "BusNumber": "TEST-001",
      "capacity": 40,
      "routeId": "R001",
      "status": "ACTIVE",
      "operatorId": "OP1760242081118",
      "model": "Test Bus Model",
      "year": 2024
    }
  ],
  "count": 1
}
```

**✅ Success Criteria:**
- Status: 200 OK
- Response has `success: true`
- Data array contains bus objects
- Each bus has required fields

### 2. 🔍 Get Specific Bus Details
**Request Setup:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}`

**Manual Test Steps:**
1. Ensure `testBusId` variable is set from previous create request
2. Click "Send"
3. **Verify Single Bus Response**:

```json
{
  "success": true,
  "data": {
    "BusID": "bus_1760243196373_yxn28nw96",
    "BusNumber": "TEST-001",
    "capacity": 40,
    "routeId": "R001",
    "status": "ACTIVE",
    "operatorId": "OP1760242081118",
    "model": "Test Bus Model",
    "year": 2024,
    "CreatedAt": "2025-10-12T04:26:36.391Z",
    "UpdatedAt": "2025-10-12T04:26:36.391Z"
  }
}
```

**✅ Success Criteria:**
- Status: 200 OK
- Returns single bus object
- All fields present and accurate

### 3. ➕ Create New Bus
**Request Setup:**
- **Method**: `POST`
- **URL**: `{{baseUrl}}/operator/buses`
- **Body** (raw JSON):

```json
{
  "busNumber": "TEST-{{$randomInt}}",
  "capacity": 45,
  "routeId": "R002",
  "status": "ACTIVE",
  "model": "Ashok Leyland",
  "year": 2024,
  "licensePlate": "ABC-1234"
}
```

**Manual Test Steps:**
1. Fill in the JSON body
2. Click "Send"
3. **Expected Response**:

```json
{
  "success": true,
  "timestamp": "2025-10-12T04:26:36.454Z",
  "BusID": "bus_1760243196373_yxn28nw96",
  "OperatorID": "OP1760242081118",
  "BusNumber": "TEST-12345",
  "Capacity": 45,
  "RouteID": "R002",
  "Status": "ACTIVE",
  "Model": "Ashok Leyland",
  "Year": 2024,
  "CreatedAt": "2025-10-12T04:26:36.391Z",
  "UpdatedAt": "2025-10-12T04:26:36.391Z"
}
```

**✅ Success Criteria:**
- Status: 201 Created
- Returns bus with generated BusID
- OperatorID matches your operator
- All submitted fields are present

### 4. ✏️ Update Bus Details
**Request Setup:**
- **Method**: `PUT`
- **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}`
- **Body**:

```json
{
  "capacity": 50,
  "status": "MAINTENANCE",
  "routeId": "R003"
}
```

**Manual Test Steps:**
1. Use existing bus ID
2. Send partial update
3. **Verify Response**:

```json
{
  "success": true,
  "message": "Bus updated successfully",
  "data": {
    "BusID": "bus_1760243196373_yxn28nw96",
    "capacity": 50,
    "status": "MAINTENANCE",
    "routeId": "R003",
    "UpdatedAt": "2025-10-12T04:30:00.000Z"
  }
}
```

**✅ Success Criteria:**
- Status: 200 OK
- Only specified fields are updated
- UpdatedAt timestamp is current

### 5. 🗑️ Delete Bus
**Request Setup:**
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}`

**Manual Test Steps:**
1. Use existing bus ID
2. Click "Send"
3. **Expected Response**:

```json
{
  "success": true,
  "message": "Bus deleted successfully"
}
```

**✅ Success Criteria:**
- Status: 200 OK
- Confirmation message received
- Subsequent GET should return 404

### 6. 📍 Update Bus Location
**Request Setup:**
- **Method**: `PUT`
- **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}/location`
- **Body**:

```json
{
  "latitude": 6.9271,
  "longitude": 79.8612,
  "speed": 45.5,
  "heading": 180,
  "timestamp": "2024-10-12T10:30:00Z"
}
```

**Manual Test Steps:**
1. Create a bus first (if deleted)
2. Send location update
3. **Verify Response**:

```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "BusID": "bus_1760243196373_yxn28nw96",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "speed": 45.5,
    "heading": 180,
    "timestamp": "2024-10-12T10:30:00Z"
  }
}
```

**✅ Success Criteria:**
- Status: 200 OK
- All location fields are echoed back
- Timestamp is preserved

### 7. 🗺️ Get Current Bus Location
**Request Setup:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/operator/buses/{{testBusId}}/location`

**Manual Test Steps:**
1. After updating location above
2. Retrieve current location
3. **Expected Response**:

```json
{
  "success": true,
  "data": {
    "BusID": "bus_1760243196373_yxn28nw96",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "speed": 45.5,
    "heading": 180,
    "timestamp": "2024-10-12T10:30:00Z",
    "lastUpdated": "2025-10-12T04:30:00.000Z"
  }
}
```

**✅ Success Criteria:**
- Status: 200 OK
- Returns most recent location data
- Matches previously submitted values

### Manual Testing Checklist

Print this checklist and check off each test:

#### Authentication Tests:
- [ ] ✅ Register operator account (201 Created)
- [ ] ✅ Login and receive JWT token (200 OK)
- [ ] ✅ Token is saved in collection variables

#### Bus Management Tests:
- [ ] ✅ Get empty bus list initially (200 OK, empty array)
- [ ] ✅ Create new bus (201 Created, BusID generated)
- [ ] ✅ Get specific bus details (200 OK, full bus object)
- [ ] ✅ Update bus information (200 OK, changes reflected)
- [ ] ✅ Delete bus (200 OK, confirmation message)

#### Location Tests:
- [ ] ✅ Update bus location (200 OK, location stored)
- [ ] ✅ Get current location (200 OK, latest location)

#### Error Handling Tests:
- [ ] ✅ Get non-existent bus (404 Not Found)
- [ ] ✅ Update deleted bus (404 Not Found)
- [ ] ✅ Invalid authorization (401 Unauthorized)
- [ ] ✅ Malformed JSON body (400 Bad Request)

---

## 🚨 Common Error Solutions

### Error 401: Unauthorized
```json
{
  "message": "Unauthorized"
}
```
**Solution:** Check your JWT token:
1. Ensure token is prefixed with `Bearer `
2. Token might be expired - login again
3. Verify token is in Authorization header

### Error 403: Forbidden
```json
{
  "message": "Access denied"
}
```
**Solution:** Role permission issue:
1. Ensure your account has `BUS_OPERATOR` role
2. Some endpoints require specific permissions
3. Contact admin if role is incorrect

### Error 404: Not Found
```json
{
  "message": "Bus not found"
}
```
**Solution:** Resource doesn't exist:
1. Check BusID is correct
2. Ensure bus belongs to your operator account
3. Bus might have been deleted

### Error 400: Bad Request
```json
{
  "message": "Validation error",
  "details": ["Bus number is required"]
}
```
**Solution:** Request validation failed:
1. Check required fields are provided
2. Verify data types (numbers, strings)
3. Ensure valid enum values (status: ACTIVE/INACTIVE/MAINTENANCE)

---

## 🧪 Testing Scenarios

### Scenario 1: Complete Bus Lifecycle
1. **Create** a new bus
2. **Update** its details
3. **Add** location updates
4. **Retrieve** bus information
5. **Delete** the bus

### Scenario 2: Location Tracking
1. Create a bus
2. Update location every 30 seconds
3. Verify location history
4. Test with different coordinates

### Scenario 3: Error Handling
1. Try accessing another operator's bus
2. Test with invalid bus IDs
3. Send malformed requests
4. Test expired tokens

### Scenario 4: Bulk Operations
1. Create multiple buses
2. Update all bus statuses
3. Retrieve all buses
4. Test pagination if available

---

## 📊 Postman Collection Structure

### Final Collection Organization:
```
🚌 Bus Operator API Testing
├── � Setup & Authentication
│   ├── 1. Register Operator
│   └── 2. Login Operator
├── 🚍 Bus Management
│   ├── 1. Get All Buses
│   ├── 2. Create New Bus
│   ├── 3. Get Bus Details
│   ├── 4. Update Bus
│   └── 5. Delete Bus
└── 📍 Location Management
    ├── 1. Update Bus Location
    └── 2. Get Bus Location
```

### Collection-Level Configuration:

#### Pre-request Script (Collection Level):
```javascript
// Auto-check if auth token exists
if (!pm.collectionVariables.get("authToken") || 
    pm.collectionVariables.get("authToken") === "Bearer ") {
    console.log("⚠️ No auth token found. Please run login request first.");
}

// Log current request
console.log("🚀 Running: " + pm.info.requestName);
```

#### Tests Script (Collection Level):
```javascript
// Common tests for all requests
pm.test("Response time is acceptable", function () {
    pm.expect(pm.response.responseTime).to.be.below(5000);
});

pm.test("Response has correct content type", function () {
    pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");
});

// Log response status
console.log("📊 Status: " + pm.response.status + " " + pm.response.code);
```

### Import/Export Collection:

#### To Export Your Collection:
1. Right-click on collection name
2. Select "Export"
3. Choose "Collection v2.1"
4. Save as `Bus-Operator-API-Testing.postman_collection.json`

#### To Import Collection:
1. Click "Import" button
2. Drag and drop the JSON file
3. Collection will be recreated with all requests

---

## 🔄 Pre-request Scripts

### Collection-Level Pre-request Script:
Add this to your collection's Pre-request Script tab:

```javascript
// Auto-check if auth token exists
if (!pm.collectionVariables.get("authToken") || 
    pm.collectionVariables.get("authToken") === "Bearer ") {
    console.log("⚠️ No auth token found. Please run login request first.");
}

// Log current request
console.log("🚀 Running: " + pm.info.requestName);

// Set dynamic timestamp for location updates
pm.collectionVariables.set("currentTimestamp", new Date().toISOString());
```

### Request-Specific Scripts:

#### For "Create New Bus" Request:
```javascript
// Generate random bus number
const randomNumber = Math.floor(Math.random() * 10000);
pm.collectionVariables.set("randomBusNumber", "TEST-" + randomNumber);
```

#### For Location Update Requests:
```javascript
// Generate random coordinates around Colombo
const baseLatitude = 6.9271;
const baseLongitude = 79.8612;
const randomLat = baseLatitude + (Math.random() - 0.5) * 0.1;
const randomLng = baseLongitude + (Math.random() - 0.5) * 0.1;

pm.collectionVariables.set("randomLatitude", randomLat);
pm.collectionVariables.set("randomLongitude", randomLng);
```

---

## ✅ Test Scripts

### Collection-Level Tests:
Add this to your collection's Tests tab:

```javascript
// Common tests for all requests
pm.test("Response time is acceptable", function () {
    pm.expect(pm.response.responseTime).to.be.below(5000);
});

pm.test("Response has correct content type", function () {
    pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");
});

pm.test("Response is valid JSON", function () {
    pm.response.to.be.json;
});

// Log response status
console.log("📊 Status: " + pm.response.status + " " + pm.response.code);
```

### Request-Specific Test Scripts:

#### For Login Request:
```javascript
pm.test("Login successful", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response).to.have.property('success', true);
    pm.expect(response.data).to.have.property('token');
    
    // Save token for other requests
    if (response.data && response.data.token) {
        pm.collectionVariables.set("authToken", "Bearer " + response.data.token);
        console.log("✅ Token saved successfully");
    }
});
```

#### For Create Bus Request:
```javascript
pm.test("Bus created successfully", function () {
    pm.response.to.have.status(201);
    const response = pm.response.json();
    pm.expect(response).to.have.property('success', true);
    pm.expect(response).to.have.property('BusID');
    
    // Save bus ID for future requests
    if (response.BusID) {
        pm.collectionVariables.set("testBusId", response.BusID);
        console.log("✅ Bus ID saved: " + response.BusID);
    }
});

pm.test("Bus has required fields", function () {
    const response = pm.response.json();
    pm.expect(response).to.have.property('OperatorID');
    pm.expect(response).to.have.property('BusNumber');
    pm.expect(response).to.have.property('Capacity');
});
```

#### For Get Buses Request:
```javascript
pm.test("Get buses successful", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response).to.have.property('success', true);
    pm.expect(response).to.have.property('data');
    pm.expect(response.data).to.be.an('array');
});

pm.test("Bus data structure is correct", function () {
    const response = pm.response.json();
    if (response.data && response.data.length > 0) {
        const bus = response.data[0];
        pm.expect(bus).to.have.property('BusID');
        pm.expect(bus).to.have.property('BusNumber');
        pm.expect(bus).to.have.property('capacity');
    }
});
```

#### For Delete Bus Request:
```javascript
pm.test("Bus deleted successfully", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response).to.have.property('success', true);
    pm.expect(response).to.have.property('message');
});

// Clear the test bus ID since it's deleted
pm.collectionVariables.unset("testBusId");
console.log("🗑️ Test bus ID cleared");
```

#### For Location Update Request:
```javascript
pm.test("Location updated successfully", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response).to.have.property('success', true);
    pm.expect(response.data).to.have.property('latitude');
    pm.expect(response.data).to.have.property('longitude');
});

pm.test("Location data is valid", function () {
    const response = pm.response.json();
    pm.expect(response.data.latitude).to.be.a('number');
    pm.expect(response.data.longitude).to.be.a('number');
    pm.expect(response.data.latitude).to.be.within(-90, 90);
    pm.expect(response.data.longitude).to.be.within(-180, 180);
});
```

---

## 🏃‍♂️ Collection Runner

### Automated Testing with Collection Runner:

#### Setup Collection Runner:
1. **Click collection name** → **Run collection**
2. **Configure run settings:**
   - **Iterations**: 1
   - **Delay**: 1000ms between requests
   - **Data file**: None (or CSV for bulk testing)
   - **Environment**: Select your environment

#### Recommended Run Order:
1. ✅ **Setup & Authentication** folder first
2. ✅ **Bus Management** folder second  
3. ✅ **Location Management** folder last

#### Batch Testing Scenarios:

**Scenario 1: Complete API Test**
- Run entire collection
- Verify all tests pass
- Check console logs for debugging

**Scenario 2: Regression Testing**
- Run after any API changes
- Ensure existing functionality works
- Validate response formats

**Scenario 3: Load Testing**
- Set iterations to 10-50
- Monitor response times
- Check for rate limiting

### Collection Runner Results:
After running, check:
- ✅ **All tests passed** (green checkmarks)
- ✅ **No failed requests** (red X marks)
- ✅ **Reasonable response times** (<3000ms)
- ✅ **Proper test coverage** (all endpoints tested)

---

## 📈 Monitoring and Analytics

### Setup Postman Monitor:
1. **Click collection** → **Monitor collection**
2. **Configure monitor:**
   - **Name**: `Bus Operator API Health Check`
   - **Environment**: Select dev environment
   - **Schedule**: Every 15 minutes
   - **Regions**: Select closest region

### Monitor Configuration:
```json
{
  "name": "Bus Operator API Monitor",
  "collection": "Bus Operator API Testing",
  "environment": "Bus API - Dev",
  "schedule": {
    "cron": "*/15 * * * *"
  },
  "notifications": {
    "onError": ["email@example.com"],
    "onFailure": ["email@example.com"]
  }
}
```

### Key Metrics to Track:
- **Response Time**: Average < 2000ms
- **Success Rate**: > 99%
- **Error Patterns**: 4xx/5xx responses
- **Endpoint Availability**: All endpoints responding

---

## 📞 Support & Troubleshooting

### Development Team Contact:
- **API Documentation:** Check the main README.md
- **GitHub Issues:** Submit bug reports
- **Environment:** Make sure you're using the correct dev/staging/prod URL

### Quick Debugging Steps:
1. ✅ Verify environment variables are set
2. ✅ Check JWT token is valid and not expired
3. ✅ Ensure correct HTTP method
4. ✅ Validate request body format
5. ✅ Check response status codes

---

## 🎯 Advanced Tips

### 1. **Environment Management:**
Create separate environments for different stages:
- `Bus API - Dev` (current working environment)
- `Bus API - Staging` (for testing)
- `Bus API - Production` (for live testing)

### 2. **Data-Driven Testing:**
Create CSV file `bus-test-data.csv`:
```csv
busNumber,capacity,routeId,status,model,year
TEST-001,40,R001,ACTIVE,Volvo,2024
TEST-002,45,R002,ACTIVE,Tata,2023
TEST-003,50,R003,MAINTENANCE,Ashok,2022
```

Use in Collection Runner for bulk testing.

### 3. **Dynamic Variables:**
Use Postman's built-in dynamic variables:
- `{{$randomInt}}` - Random integer
- `{{$randomFirstName}}` - Random first name
- `{{$randomCompanyName}}` - Random company name
- `{{$isoTimestamp}}` - Current ISO timestamp

### 4. **Request Chaining:**
Link requests using test scripts:
```javascript
// In Create Bus test script
if (pm.response.code === 201) {
    const busId = pm.response.json().BusID;
    pm.collectionVariables.set("newBusId", busId);
    
    // Automatically run next request
    postman.setNextRequest("Get Bus Details");
}
```

### 5. **Error Simulation:**
Test error scenarios manually:
- **401 Errors**: Remove authorization header
- **404 Errors**: Use non-existent bus ID `INVALID_BUS_ID`
- **400 Errors**: Send malformed JSON or missing required fields

### 6. **Performance Testing:**
Monitor key performance indicators:
```javascript
// Add to collection tests
pm.test("Response time is under 2 seconds", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});

pm.test("No server errors", function () {
    pm.response.to.not.have.status(500);
});
```

---

## 🛠️ Troubleshooting Guide

### Common Issues and Solutions:

#### Issue 1: "Token is not valid" Error
**Symptoms:**
```json
{
  "message": "Token is not valid",
  "statusCode": 401
}
```

**Solutions:**
1. ✅ **Check token format**: Must be `Bearer <token>`
2. ✅ **Verify token expiry**: Login again to get fresh token
3. ✅ **Check collection variables**: Ensure `authToken` is set correctly
4. ✅ **Test with manual token**: Copy-paste token directly to verify

**Manual Verification:**
```javascript
// Add to pre-request script
console.log("Current token: " + pm.collectionVariables.get("authToken"));
```

#### Issue 2: Variables Not Updating
**Symptoms:** Old values persist in requests

**Solutions:**
1. ✅ **Clear collection variables**: Reset and run login again
2. ✅ **Check variable scope**: Use collection variables, not environment
3. ✅ **Verify test scripts**: Ensure variables are set correctly

**Debug Script:**
```javascript
// Add to any request's test script
console.log("All collection variables:");
console.log(pm.collectionVariables.toObject());
```

#### Issue 3: 502 Bad Gateway Errors
**Symptoms:** Server errors during requests

**Solutions:**
1. ✅ **Check API status**: Verify the API is deployed and running
2. ✅ **Verify base URL**: Ensure correct environment URL
3. ✅ **Wait and retry**: Temporary server issues
4. ✅ **Check CloudWatch logs**: For detailed error information

#### Issue 4: CORS Errors in Browser
**Note:** This shouldn't happen in Postman desktop app, but if using web version:

**Solutions:**
1. ✅ **Use Postman Desktop**: Recommended for API testing
2. ✅ **Enable proxy**: In Postman web settings
3. ✅ **Disable web security**: For development only

### Debug Request Template:
Create a debug request to test connectivity:

```
GET {{baseUrl}}/status/ping
Authorization: {{authToken}}
```

This should return basic health status without authentication.

---

## 📚 Learning Resources

### Postman Basics:
- [Postman Learning Center](https://learning.postman.com/)
- [API Testing Best Practices](https://www.postman.com/api-testing/)
- [Collection Variables Guide](https://learning.postman.com/docs/sending-requests/variables/)

### API Testing Concepts:
- **HTTP Status Codes**: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)
- **REST API Methods**: GET (retrieve), POST (create), PUT (update), DELETE (remove)
- **JSON Validation**: Ensure response structure matches expected format
- **Authentication**: Bearer token in Authorization header

### Advanced Postman Features:
- **Mock Servers**: Test against simulated responses
- **API Documentation**: Generate docs from collections
- **Code Generation**: Generate code snippets for different languages
- **Team Collaboration**: Share collections with team members

---

**📝 Note:** This guide assumes the operator endpoints are properly deployed and accessible. Always test with valid data and ensure you have the necessary permissions before running these requests.

**🔒 Security:** Never share your JWT tokens or credentials. Always use environment variables for sensitive data.