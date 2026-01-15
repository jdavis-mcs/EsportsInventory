// --- FIREBASE CONFIGURATION ---
// REPLACE THIS OBJECT WITH YOUR FIREBASE CONSOLE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyAKemBw53vs87N6bRStSCxpqKVzJbxvxFw",
    authDomain: "esportsinventory.firebaseapp.com",
    projectId: "esportsinventory",
    storageBucket: "esportsinventory.firebasestorage.app",
    messagingSenderId: "570093740879",
    appId: "1:570093740879:web:7a41247401d70209679b3a",
    measurementId: "G-91210GKFLJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// --- AUTH LOGIC ---
// Restrict to specific domain if desired
const ALLOWED_DOMAIN = "madison.k12.in.us"; // Change to your school domain or set to null to disable

function login() {
    auth.signInWithPopup(provider).then((result) => {
        const email = result.user.email;
        if (ALLOWED_DOMAIN && !email.endsWith(ALLOWED_DOMAIN)) {
            alert("Access Restricted: Please use your school account.");
            auth.signOut();
        }
    }).catch((error) => console.error(error));
}

function logout() { auth.signOut(); }

auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('d-none');
        document.getElementById('app-content').classList.remove('d-none');
        document.getElementById('user-display').innerText = `User: ${user.email}`;
        loadInventory();
    } else {
        document.getElementById('login-screen').classList.remove('d-none');
        document.getElementById('app-content').classList.add('d-none');
    }
});

// --- CRUD LOGIC ---
let inventoryData = [];
let editingId = null;

function loadInventory() {
    db.collection("inventory").onSnapshot((snapshot) => {
        const list = document.getElementById('inventory-list');
        list.innerHTML = '';
        inventoryData = [];
        let borrowedCount = 0;

        snapshot.forEach((doc) => {
            const item = doc.data();
            item.id = doc.id;
            inventoryData.push(item);

            if(item.status === 'Student' || item.status === 'Staff') borrowedCount++;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.assetId}</strong></td>
                <td>${item.productName}</td>
                <td>${item.manufacturer}</td>
                <td><span class="badge ${getStatusBadge(item.status)}">${item.status}</span></td>
                <td>${item.borrowerName || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editItem('${item.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id}')"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-sm btn-dark" onclick="printTags('${item.id}')"><i class="fas fa-tag"></i> Tags</button>
                </td>
            `;
            list.appendChild(row);
        });

        document.getElementById('total-count').innerText = inventoryData.length;
        document.getElementById('borrowed-count').innerText = borrowedCount;
    });
}

function getStatusBadge(status) {
    if(status === 'Locker') return 'bg-success';
    if(status === 'Repair') return 'bg-danger';
    return 'bg-warning text-dark';
}

// Open Modal for New or Edit
function resetForm() {
    document.getElementById('inventoryForm').reset();
    document.getElementById('docId').value = '';
    editingId = null;
    toggleBorrowFields();
}

function editItem(id) {
    const item = inventoryData.find(i => i.id === id);
    if (!item) return;

    editingId = id;
    document.getElementById('docId').value = id;
    document.getElementById('productName').value = item.productName;
    document.getElementById('assetId').value = item.assetId;
    document.getElementById('manufacturer').value = item.manufacturer;
    document.getElementById('serialNumber').value = item.serialNumber;
    document.getElementById('status').value = item.status;
    document.getElementById('borrowerName').value = item.borrowerName || '';
    document.getElementById('returnDate').value = item.returnDate || '';
    
    toggleBorrowFields();
    
    // Bootstrap 5 Modal toggle logic
    const modal = new bootstrap.Modal(document.getElementById('itemModal'));
    modal.show();
}

function toggleBorrowFields() {
    const status = document.getElementById('status').value;
    const fields = document.getElementById('borrowFields');
    if (status === 'Student' || status === 'Staff') {
        fields.classList.remove('d-none');
        document.getElementById('borrowerName').required = true;
    } else {
        fields.classList.add('d-none');
        document.getElementById('borrowerName').required = false;
    }
}

function saveItem() {
    const id = document.getElementById('docId').value;
    const status = document.getElementById('status').value;
    
    const data = {
        productName: document.getElementById('productName').value,
        assetId: document.getElementById('assetId').value,
        manufacturer: document.getElementById('manufacturer').value,
        serialNumber: document.getElementById('serialNumber').value,
        status: status,
        borrowerName: (status === 'Student' || status === 'Staff') ? document.getElementById('borrowerName').value : '',
        returnDate: (status === 'Student' || status === 'Staff') ? document.getElementById('returnDate').value : ''
    };

    if (id) {
        db.collection("inventory").doc(id).update(data).then(() => {
            // Check if we need to print Borrow Forms
            if (status === 'Student' || status === 'Staff') {
               if(confirm("Item assigned. Print Borrow/Loan Agreement forms?")) {
                   printBorrowForms(data);
               }
            }
            closeModal();
        });
    } else {
        db.collection("inventory").add(data).then(() => {
            closeModal();
        });
    }
}

function deleteItem(id) {
    if(confirm('Are you sure you want to delete this item?')) {
        db.collection("inventory").doc(id).delete();
    }
}

function closeModal() {
    const modalEl = document.getElementById('itemModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
}

// --- PRINTING LOGIC ---

// 1. Print Inventory Tags (Batch 2 tags onto one 4x6 sheet)
// Note: Since user wants "batch these", we can print two identical or two different.
// For simplicity, this function prints ONE asset's tag twice on one sheet (Top/Bottom).
function printTags(id) {
    const item = inventoryData.find(i => i.id === id);
    const printArea = document.getElementById('print-area');
    
    // HTML for two 4x3 tags stacked vertically
    printArea.innerHTML = `
        <div class="label-sheet-4x6">
            <div class="batch-container">
                <div class="tag-4x3">
                    <div class="tag-title">PROPERTY OF ESPORTS</div>
                    <div class="tag-asset">${item.assetId}</div>
                    <div class="tag-meta">${item.manufacturer} - ${item.productName}</div>
                    <div class="tag-meta">SN: ${item.serialNumber}</div>
                </div>
                <div class="tag-4x3">
                    <div class="tag-title">PROPERTY OF ESPORTS</div>
                    <div class="tag-asset">${item.assetId}</div>
                    <div class="tag-meta">${item.manufacturer} - ${item.productName}</div>
                    <div class="tag-meta">SN: ${item.serialNumber}</div>
                </div>
            </div>
        </div>
    `;
    window.print();
}

// 2. Print Borrow Forms (2 separate 4x6 labels)
function printBorrowForms(item) {
    const printArea = document.getElementById('print-area');
    const terms = "Only for this day only, must be back by printed time, if not returned by borrow time, a request for replacement form will be issued.";
    
    const formHTML = (copyType) => `
        <div class="label-sheet-4x6">
            <div class="borrow-form">
                <div class="borrow-header">
                    <h2>ESPORTS LOAN AGREEMENT</h2>
                    <small>${copyType}</small>
                </div>
                <div class="borrow-body">
                    <p><strong>Asset:</strong> ${item.assetId}</p>
                    <p><strong>Item:</strong> ${item.productName}</p>
                    <p><strong>Borrower:</strong> ${item.borrowerName}</p>
                    <p><strong>Out:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Return By:</strong> ${new Date(item.returnDate).toLocaleString()}</p>
                </div>
                <div class="borrow-terms">
                    <strong>TERMS:</strong> ${terms}
                </div>
                <div class="borrow-sign">
                    <div class="sign-line"></div>
                    <small>Signature</small>
                </div>
            </div>
        </div>
    `;

    // Create 2 sheets: One for School, One for Student
    printArea.innerHTML = formHTML("SCHOOL COPY") + formHTML("STUDENT COPY");
    
    // Use a timeout to ensure DOM renders before print dialog
    setTimeout(() => window.print(), 500);
}