# Frontend Requirements

## Overview
Plain HTML, CSS, and JavaScript application. All data is fetched from the backend via API calls. No page reloads — interactions are handled client-side.

---

## Pages

### 1. Register Page
- Fields: Full Name, Email
- On submit, an OTP is sent to the provided email
- After OTP is sent, show an OTP input screen
- After OTP is verified, show a password setup screen
- Password setup has two fields: Password and Confirm Password
- On successful registration, redirect to the Login page

### 2. Login Page
- Fields: Email, Password
- On successful login, redirect to the appropriate dashboard
  - Regular users go to the My Complaints page
  - Admins go to the Admin Dashboard

### 3. Complaint Submission Page (User only)
- A text area where the user types their complaint
- A button to submit the complaint text to get an AI follow-up question
- The AI follow-up question is displayed below the text area
- A second text area appears for the user to answer the follow-up question
- A final Submit button to save the full complaint
- After submission, show a success message and redirect to My Complaints page

### 4. My Complaints Page (User only)
- A "Submit New Complaint" button that navigates to the Complaint Submission page
- Shows a list of all complaints submitted by the logged-in user
- Each complaint shows:
  - The original complaint text
  - The AI follow-up question
  - The user's answer to the follow-up
  - The date the complaint was submitted

### 5. Admin Dashboard (Admin only)
- Shows a list of all complaints from all users
- Each complaint shows:
  - The name and email of the user who submitted it
  - The original complaint text
  - The AI follow-up question
  - The user's answer to the follow-up
  - The date the complaint was submitted

---

## Navigation
- Unauthenticated users can only access Register and Login pages
- Authenticated regular users can access Complaint Submission and My Complaints
- Authenticated admin users can access the Admin Dashboard
- A logout button is visible on all authenticated pages
- On every page load, the frontend calls the session check endpoint to verify the user is still logged in and to determine their role — if not logged in, redirect to Login

## Error Handling
- Show an inline error message when any API call fails (wrong password, invalid OTP, email already registered, etc.)
- Errors should appear near the relevant form field or at the top of the form without a full page reload

---

## API Calls Made by Frontend

### Auth
- Send OTP: sends name and email, triggers OTP email
- Register: sends the OTP code entered by the user and the chosen password to backend
- Login: sends email and password — the backend sets the JWT as a cookie automatically
- Logout: calls the logout endpoint so the backend clears the JWT cookie
- Session Check: called on every page load to verify the session and retrieve the user's role

### Complaint Flow
- Get AI Question: sends the complaint text, receives an AI-generated follow-up question
- Submit Complaint: sends complaint text, AI question, and user's answer to the follow-up

### Complaints Viewing
- Fetch My Complaints: fetches complaints belonging to the logged-in user
- Fetch All Complaints (Admin): fetches all complaints from all users


---

### Coding Instructions
- Create Seperate HTML pages inside Pages folder
