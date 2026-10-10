const firebaseConfig = {
  apiKey: "AIzaSyDeM5GMJFWmFNDGFDeQdxb0P70XcjjLwS8",
  authDomain: "equipay-5bbe7.firebaseapp.com",
  projectId: "equipay-5bbe7",
  storageBucket: "equipay-5bbe7.firebasestorage.app",
  messagingSenderId: "711668340598",
  appId: "1:711668340598:web:cbf41fc9712f16a2cacc57",
};

// Initialize Firebase only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
