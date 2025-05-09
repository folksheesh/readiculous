// Import Firebase and required methods
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { renderReviews } from './reviews.js'; // Assuming renderReviews is in reviews.js

// Import the Firebase configuration from config.js
import { firebaseConfig } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentBookKey = null; // Global variable to store current book key
let currentUser = null; // Store current user state

window.addEventListener("DOMContentLoaded", function () {
    const usernameElement = document.getElementById('username');
    const logoutBtn = document.getElementById('logoutBtn');

    const discoverBtn = document.getElementById("discoverBtn");
    const genreBtn = document.getElementById("genreBtn");
    const aboutBtn = document.getElementById("aboutBtn");

    const discoverSection = document.getElementById("discover");
    const genreSection = document.getElementById("genre");
    const aboutSection = document.getElementById("about");

    // Default section display
    discoverSection.style.display = "none";
    aboutSection.style.display = "none";
    genreSection.style.display = "block";

    // Firebase Auth state listener
    onAuthStateChanged(auth, (user) => {
        currentUser = user; // Update current user state
        if (!usernameElement) return;

        if (user) {
            const username = user.displayName || user.email;
            usernameElement.textContent = `Hi, ${username}`;
            usernameElement.style.cursor = "pointer";

            // Tambahkan kelas dropdown
            usernameElement.classList.add('dropdown-toggle');
            usernameElement.setAttribute('data-bs-toggle', 'dropdown');
            usernameElement.setAttribute('aria-expanded', 'false');

            // Pastikan container dropdown tersedia
            const dropdownMenu = document.getElementById('userDropdown');
            if (dropdownMenu) dropdownMenu.style.display = 'block';

            usernameElement.onclick = null; // biar default Bootstrap behavior
        } else {
            usernameElement.textContent = "Login / Register";
            usernameElement.style.cursor = "pointer";

            // Hapus kelas dropdown
            usernameElement.classList.remove('dropdown-toggle');
            usernameElement.removeAttribute('data-bs-toggle');
            usernameElement.removeAttribute('aria-expanded');
            usernameElement.classList.add('login-hover'); // tambahkan class hover


            // Sembunyikan dropdown jika ada
            const dropdownMenu = document.getElementById('userDropdown');
            if (dropdownMenu) dropdownMenu.style.display = 'none';

            usernameElement.onclick = () => {
                window.location.href = "login.html";
            };
        }
    });


    // Logout functionality
    logoutBtn.addEventListener("click", function (e) {
        e.preventDefault(); // prevent link behavior

        // Use signOut from modular Firebase SDK
        signOut(auth).then(() => {
            console.log("User signed out.");
            window.location.href = "index.html"; // redirect to login or home page
        }).catch((error) => {
            console.error("Logout error:", error);
        });
    });

    // Menu active toggle
    document.querySelectorAll('.menu .nav-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.menu .nav-link').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Navigation buttons
    discoverBtn.addEventListener("click", function (e) {
        e.preventDefault();
        discoverSection.style.display = "block";
        genreSection.style.display = "none";
        aboutSection.style.display = "none";
    });

    genreBtn.addEventListener("click", function (e) {
        e.preventDefault();
        discoverSection.style.display = "none";
        aboutSection.style.display = "none";
        genreSection.style.display = "block";
    });

    aboutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        discoverSection.style.display = "none";
        aboutSection.style.display = "block";
        genreSection.style.display = "none";
    });

    // Load categories
    const categories = ['fantasy', 'horror', 'romance'];
    categories.forEach(category => {
        fetch(`https://openlibrary.org/subjects/${category}.json?limit=6`)
            .then(response => response.json())
            .then(data => {
                const container = document.getElementById(category);
                data.works.slice(0, 6).forEach(book => {
                    const coverUrl = book.cover_id
                        ? `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`
                        : 'https://via.placeholder.com/120x180?text=No+Image';

                    const author = book.authors && book.authors.length > 0
                        ? book.authors.map(a => a.name).join(', ')
                        : 'Unknown Author';

                    const title = book.title;

                    const bookElement = document.createElement('div');
                    bookElement.classList.add('text-center', 'book');
                    bookElement.style.cursor = 'pointer';
                    bookElement.innerHTML = ` 
                        <img src="${coverUrl}" class="rounded shadow-sm mb-2" style="width: 140px; height: 220px; object-fit: cover;">
                        <p class="small text-muted">${author}</p>
                        <p class="small fw-semibold mb-0">${title}</p>
                    `;

                    bookElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showDetail(coverUrl, title, author, book.key);
                    });

                    container.appendChild(bookElement);
                });
            })
            .catch(error => console.error('Error fetching books:', error));
    });

    // Close detail when clicking outside the book details
    document.addEventListener('click', function (e) {
        const detailPanel = document.getElementById('book-detail');
        const mainWrapper = document.getElementById('main-wrapper');
        const isClickInsideDetail = detailPanel.contains(e.target);
        const isClickOnBook = e.target.closest('.book');

        if (!isClickInsideDetail && !isClickOnBook) {
            mainWrapper.classList.remove('split');
            detailPanel.classList.remove('active');
        }
    });

    // Render reviews if function exists
    if (typeof renderReviews === 'function') {
        renderReviews();
    }
});

// Show book detail function
function showDetail(image, title, author, key) {
    currentBookKey = key;
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.setAttribute('book-id', key);
    }

    // Update detail UI
    document.getElementById('detail-img').src = image;
    document.getElementById('detail-title').textContent = title;
    document.getElementById('detail-author').textContent = author;
    document.getElementById('detail-description').textContent = "Loading description...";

    document.getElementById('main-wrapper').classList.add('split');
    document.getElementById('book-detail').classList.add('active');

    // Render reviews based on book key
    renderReviews(key);

    // Fetch description from OpenLibrary
    fetch(`https://openlibrary.org${key}.json`)
        .then(res => res.json())
        .then(data => {
            const desc = typeof data.description === 'string'
                ? data.description
                : data.description?.value || 'No description available.';
            updateDescription(desc);
        })
        .catch(err => {
            console.error('Failed to load description:', err);
            document.getElementById('detail-description').textContent = 'No description available.';
        });
}

// Update description in UI
function updateDescription(description) {
    const descElement = document.getElementById('detail-description');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    const maxLength = 300;
    let isExpanded = false;

    const shortDesc = description.length > maxLength
        ? description.slice(0, maxLength) + "..."
        : description;

    // Initial state
    descElement.textContent = shortDesc;
    loadMoreBtn.style.display = description.length > maxLength ? 'inline' : 'none';
    loadMoreBtn.textContent = "Load More";

    // Button click handler
    loadMoreBtn.onclick = () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            descElement.textContent = description;
            loadMoreBtn.textContent = "Load Less";
        } else {
            descElement.textContent = shortDesc;
            loadMoreBtn.textContent = "Load More";
        }
    };
}

const loginRedirectBtn = document.getElementById("loginRedirectBtn");

if (loginRedirectBtn) {
    loginRedirectBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.location.href = "login.html"; // redirect to your login page
    });
}
