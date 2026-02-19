# 🔥 Firebase Setup Guide - Real-Time Gantt Chart

This guide will walk you through setting up Firebase for real-time collaboration. **Time needed: ~20 minutes**

---

## 📋 What You're Setting Up

- **Firebase Authentication** - Google sign-in for your team
- **Firestore Database** - Real-time data storage
- **Security Rules** - Who can access what

---

## 🚀 Step 1: Create Firebase Project

### 1.1 Go to Firebase Console
- Visit: https://console.firebase.google.com/
- Sign in with your Google account

### 1.2 Create New Project
1. Click **"Add project"** or **"Create a project"**
2. **Project name:** "Gantt Chart App" (or whatever you want)
3. Click **Continue**
4. **Google Analytics:** You can disable this (not needed)
5. Click **Create project**
6. Wait ~30 seconds for it to be created
7. Click **Continue**

✅ **Checkpoint:** You should see your project dashboard

---

## 🔐 Step 2: Enable Authentication

### 2.1 Go to Authentication
1. In the left sidebar, click **"Build"** → **"Authentication"**
2. Click **"Get started"**

### 2.2 Enable Google Sign-In
1. Click the **"Sign-in method"** tab
2. Click **"Google"**
3. Toggle **"Enable"** to ON
4. **Project support email:** Select your email from dropdown
5. Click **"Save"**

### 2.3 Enable Email/Password Sign-In
1. Still in "Sign-in method" tab
2. Click **"Email/Password"**
3. Toggle **"Enable"** to ON
4. Click **"Save"**

✅ **Checkpoint:** Google and Email/Password should show as "Enabled"

---

## 💾 Step 3: Create Firestore Database

### 3.1 Go to Firestore
1. In the left sidebar, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**

### 3.2 Security Rules
1. Choose **"Start in production mode"** (we'll add rules next)
2. Click **"Next"**

### 3.3 Location
1. Choose your closest location (e.g., **"us-central"** for USA)
2. Click **"Enable"**
3. Wait ~30 seconds for database creation

✅ **Checkpoint:** You should see an empty Firestore database

---

## 🔒 Step 4: Set Up Security Rules

### 4.1 Go to Rules Tab
1. In Firestore Database, click the **"Rules"** tab at the top

### 4.2 Copy These Rules
Replace everything with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is a project member
    function isMember(projectId) {
      let project = get(/databases/$(database)/documents/projects/$(projectId));
      return request.auth.uid in project.data.members[].uid 
        || request.auth.email in project.data.members[].email;
    }
    
    // Helper function to check user's role
    function getRole(projectId) {
      let project = get(/databases/$(database)/documents/projects/$(projectId));
      let membersList = project.data.members;
      let userMember = membersList.filter(m => 
        m.uid == request.auth.uid || m.email == request.auth.email
      )[0];
      return userMember.role;
    }
    
    // Projects collection
    match /projects/{projectId} {
      // Anyone authenticated can create a project
      allow create: if request.auth != null;
      
      // Members can read their projects
      allow read: if request.auth != null && isMember(projectId);
      
      // Owners and editors can update
      allow update: if request.auth != null && 
        isMember(projectId) && 
        (getRole(projectId) == 'owner' || getRole(projectId) == 'editor');
      
      // Only owners can delete
      allow delete: if request.auth != null && 
        isMember(projectId) && 
        getRole(projectId) == 'owner';
    }
    
    // Users collection (for user profiles - optional)
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4.3 Publish Rules
1. Click **"Publish"**
2. Wait for confirmation

✅ **Checkpoint:** Rules should show as "Active"

---

## 🔑 Step 5: Get Your Firebase Config

### 5.1 Go to Project Settings
1. Click the **gear icon** (⚙️) in the left sidebar next to "Project Overview"
2. Click **"Project settings"**

### 5.2 Add a Web App
1. Scroll down to **"Your apps"**
2. Click the **</>** (web) icon
3. **App nickname:** "Gantt Chart Web"
4. **Don't** check "Firebase Hosting"
5. Click **"Register app"**

### 5.3 Copy Your Config
You'll see code that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAbc123...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

**✏️ COPY THESE VALUES** - you'll need them in Step 6!

Click **"Continue to console"**

✅ **Checkpoint:** You have all 6 config values copied

---

## 📝 Step 6: Add Config to Your App

### 6.1 Open Your Project Folder
The `gantt-firebase` folder you'll download

### 6.2 Create .env.local File
1. Copy `.env.local.template` to `.env.local`
2. Or create a new file called `.env.local`

### 6.3 Fill in Your Values
Replace the placeholders with YOUR Firebase config:

```bash
# Your Gemini API Key (keep this)
GEMINI_API_KEY=your_existing_gemini_key

# Firebase Config (replace these with YOUR values)
VITE_FIREBASE_API_KEY=AIzaSyAbc123...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc123
```

**Save the file!**

✅ **Checkpoint:** Your `.env.local` file has all Firebase values

---

## 🌐 Step 7: Configure for Netlify

### 7.1 Add Authorized Domain
Back in Firebase Console:
1. Go to **Authentication** → **Settings** tab
2. Scroll to **"Authorized domains"**
3. Click **"Add domain"**
4. Add your Netlify URL: `your-app-name.netlify.app`
5. Click **"Add"**

### 7.2 Add Environment Variables to Netlify
1. Go to your Netlify dashboard
2. Click your site → **"Site configuration"** → **"Environment variables"**
3. Add these variables (one by one):

| Key | Value (from your Firebase config) |
|-----|-------------------------------------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `VITE_FIREBASE_API_KEY` | Your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | your-project-id |
| `VITE_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 123456789 |
| `VITE_FIREBASE_APP_ID` | 1:123:web:abc123 |

4. Click **"Save"**

✅ **Checkpoint:** All 7 environment variables added to Netlify

---

## 🚀 Step 8: Deploy Your App

### 8.1 Push to GitHub
```bash
cd path/to/gantt-firebase

git add .
git commit -m "Added Firebase real-time collaboration"
git push
```

### 8.2 Netlify Auto-Deploys
1. Netlify detects your push
2. Builds your app (~2 minutes)
3. You get a "Published" notification

### 8.3 Test It!
1. Open your Netlify URL
2. You should see the sign-in screen!
3. Click "Continue with Google"
4. Sign in
5. You're in! 🎉

---

## 📊 Step 9: Import Your Existing Data

### 9.1 Sign In to Your App
- Use Google sign-in or create an email account

### 9.2 Import from Browser
1. You'll see an **"Import from Browser Storage"** button
2. Click it
3. Your 60+ tasks will transfer to Firebase!
4. Done! ✅

---

## 🎉 You're All Set!

Your Firebase-powered Gantt chart is now:
- ✅ Real-time collaborative
- ✅ Securely authenticated
- ✅ Ready for your team

---

## 🆘 Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
- **Fix:** Add your Netlify URL to Authorized domains in Firebase Authentication settings

### "Missing or insufficient permissions"
- **Fix:** Double-check your Firestore security rules are published correctly

### "Firebase config not found"
- **Fix:** Make sure `.env.local` file exists and has all 6 Firebase values

### Can't sign in with Google
- **Fix:** Make sure Google sign-in is enabled in Firebase Authentication

### Data not syncing
- **Fix:** Check browser console for errors. Make sure you're signed in.

---

## 📞 Need Help?

Common issues:
- **Firestore rules** - Make sure they're published
- **Environment variables** - Check they're in both `.env.local` AND Netlify
- **Authorized domains** - Your Netlify URL must be in Firebase

---

## 🎊 Next Steps

1. **Invite your team** - Share button in the app
2. **Test real-time** - Open in two browsers, see changes instantly!
3. **Enjoy collaboration** - No more manual refresh! 🚀

---

**Congratulations! You now have a professional, real-time collaborative Gantt chart!** 🎉
