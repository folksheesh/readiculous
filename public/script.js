//script.js

// Import Firebase and required methods
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, getDoc, collection, getDocs, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { renderReviews } from './reviews.js';
import { firebaseConfig } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentBookKey = null;
let currentUser = null;

// ========== BOOKMARK FUNCTIONS ==========

// Function untuk menambah bookmark (hanya simpan ID untuk konsistensi dengan Flutter)
async function addBookmark(bookId, userId) {
    const bookmarkData = {
        userId: userId,
        bookId: bookId.replace('/works/', ''), // Hilangkan prefix '/works/'
        createdAt: serverTimestamp()
        // Tidak simpan title, author, image - akan diambil dari API
    };
    
    const docRef = await addDoc(collection(db, "bookmarks"), bookmarkData);
    return docRef.id;
}

// Updated loadBookmarkedBooks function - fetch data dari API untuk konsistensi
async function loadBookmarkedBooks() {
    const user = auth.currentUser;
    const bookmarkList = document.getElementById('bookmark-list');
    
    if (!bookmarkList) return;
    bookmarkList.innerHTML = '<p class="text-white">Loading bookmarks...</p>';

    if (!user) {
        bookmarkList.innerHTML = `<p class="text-white">Please log in to view your bookmarks.</p>`;
        return;
    }

    try {
        // Query bookmarks - hanya ambil ID
        const bookmarkRef = collection(db, 'bookmarks');
        const q = query(bookmarkRef, where("userId", "==", user.uid));
        const bookmarkSnap = await getDocs(q);

        if (bookmarkSnap.empty) {
            bookmarkList.innerHTML = `<p class="text-white">You haven't bookmarked any books yet.</p>`;
            return;
        }

        bookmarkList.innerHTML = ''; // Clear loading message

        // Process each bookmark
        for (const docSnap of bookmarkSnap.docs) {
            const bookmarkData = docSnap.data();
            const docId = docSnap.id;
            const bookId = bookmarkData.bookId;

            // Create placeholder card first
            const col = document.createElement('div');
            col.className = 'col-md-3 mb-3';
            col.innerHTML = `
                <div class="card h-100">
                    <div class="card-img-top d-flex justify-content-center align-items-center" 
                         style="height: 200px; background-color: #f8f9fa;">
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div class="card-body d-flex flex-column justify-content-between">
                        <div>
                            <h5 class="card-title">Loading...</h5>
                            <p class="card-text text-muted">Loading...</p>
                        </div>
                        <div class="d-flex justify-content-between mt-3">
                            <button class="btn btn-sm btn-outline-primary" disabled>Loading...</button>
                            <button class="btn btn-sm btn-outline-danger delete-bookmark-btn" 
                                    data-doc-id="${docId}">Remove</button>
                        </div>
                    </div>
                </div>
            `;
            bookmarkList.appendChild(col);

            // Fetch book details from API
            try {
                const response = await fetch(`https://openlibrary.org/works/${bookId}.json`);
                const bookData = await response.json();
                
                // Get book cover
                let coverUrl = 'https://via.placeholder.com/120x180?text=No+Image';
                if (bookData.covers && bookData.covers.length > 0) {
                    coverUrl = `https://covers.openlibrary.org/b/id/${bookData.covers[0]}-M.jpg`;
                }

                // Get book title
                const title = bookData.title || 'Unknown Title';

                // Get authors
                let author = 'Unknown Author';
                if (bookData.authors && bookData.authors.length > 0) {
                    // Fetch author details
                    const authorResponse = await fetch(`https://openlibrary.org${bookData.authors[0].author.key}.json`);
                    const authorData = await authorResponse.json();
                    author = authorData.name || 'Unknown Author';
                }

                // Update the card with real data
                col.innerHTML = `
                    <div class="card h-100">
                        <img src="${coverUrl}" 
                             class="card-img-top" alt="${title}" 
                             style="height: 200px; object-fit: cover;"
                             onerror="this.src='https://via.placeholder.com/120x180?text=No+Image'">
                        <div class="card-body d-flex flex-column justify-content-between">
                            <div>
                                <h5 class="card-title">${title}</h5>
                                <p class="card-text text-muted">${author}</p>
                            </div>
                            <div class="d-flex justify-content-between mt-3">
                                <button class="btn btn-sm btn-outline-primary view-detail-btn" 
                                        data-book-id="${bookId}" 
                                        data-title="${title}" 
                                        data-author="${author}" 
                                        data-image="${coverUrl}">View Details</button>
                                <button class="btn btn-sm btn-outline-danger delete-bookmark-btn" 
                                        data-doc-id="${docId}">Remove</button>
                            </div>
                        </div>
                    </div>
                `;

                // Re-attach event listeners for this specific card
                const viewBtn = col.querySelector('.view-detail-btn');
                const deleteBtn = col.querySelector('.delete-bookmark-btn');

                if (viewBtn) {
                    viewBtn.addEventListener('click', () => {
                        showDetail(coverUrl, title, author, `/works/${bookId}`);
                    });
                }

                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async () => {
                        try {
                            await deleteDoc(doc(db, 'bookmarks', docId));
                            loadBookmarkedBooks(); // Refresh setelah hapus
                        } catch (error) {
                            console.error('Error removing bookmark:', error);
                            alert('Failed to remove bookmark. Please try again.');
                        }
                    });
                }

            } catch (error) {
                console.error(`Error loading book ${bookId}:`, error);
                // Update card to show error
                col.innerHTML = `
                    <div class="card h-100">
                        <div class="card-img-top d-flex justify-content-center align-items-center" 
                             style="height: 200px; background-color: #f8f9fa;">
                            <i class="fas fa-exclamation-triangle text-warning"></i>
                        </div>
                        <div class="card-body d-flex flex-column justify-content-between">
                            <div>
                                <h5 class="card-title text-muted">Failed to load</h5>
                                <p class="card-text text-muted">Book data unavailable</p>
                            </div>
                            <div class="d-flex justify-content-between mt-3">
                                <button class="btn btn-sm btn-outline-secondary" disabled>Unavailable</button>
                                <button class="btn btn-sm btn-outline-danger delete-bookmark-btn" 
                                        data-doc-id="${docId}">Remove</button>
                            </div>
                        </div>
                    </div>
                `;

                // Still attach delete event
                const deleteBtn = col.querySelector('.delete-bookmark-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async () => {
                        try {
                            await deleteDoc(doc(db, 'bookmarks', docId));
                            loadBookmarkedBooks();
                        } catch (error) {
                            console.error('Error removing bookmark:', error);
                            alert('Failed to remove bookmark. Please try again.');
                        }
                    });
                }
            }
        }

    } catch (error) {
        console.error('Error loading bookmarks:', error);
        bookmarkList.innerHTML = `<p class="text-white">Error loading bookmarks. Please try again.</p>`;
    }
}

// ========== MAIN APPLICATION LOGIC ==========

window.addEventListener("DOMContentLoaded", function () {
    const usernameElement = document.getElementById('username');
    const logoutBtn = document.getElementById('logoutBtn');

    const discoverBtn = document.getElementById("discoverBtn");
    const genreBtn = document.getElementById("genreBtn");
    const aboutBtn = document.getElementById("aboutBtn");

    const discoverSection = document.getElementById("discover");
    const genreSection = document.getElementById("genre");
    const aboutSection = document.getElementById("about");
    const bookmarkSection = document.getElementById("bookmark");

    // Initial section display
    if (discoverSection) discoverSection.style.display = "none";
    if (aboutSection) aboutSection.style.display = "none";
    if (bookmarkSection) bookmarkSection.style.display = "none";
    if (genreSection) genreSection.style.display = "block";

    // Auth state management
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (!usernameElement) return;

        if (user) {
            const username = user.displayName || user.email;
            usernameElement.textContent = `Hi, ${username}`;
            usernameElement.style.cursor = "pointer";

            usernameElement.classList.add('dropdown-toggle');
            usernameElement.setAttribute('data-bs-toggle', 'dropdown');
            usernameElement.setAttribute('aria-expanded', 'false');

            const dropdownMenu = document.getElementById('userDropdown');
            if (dropdownMenu) dropdownMenu.style.display = 'block';

            usernameElement.onclick = null;
        } else {
            usernameElement.textContent = "Login / Register";
            usernameElement.style.cursor = "pointer";

            usernameElement.classList.remove('dropdown-toggle');
            usernameElement.removeAttribute('data-bs-toggle');
            usernameElement.removeAttribute('aria-expanded');
            usernameElement.classList.add('login-hover');

            const dropdownMenu = document.getElementById('userDropdown');
            if (dropdownMenu) dropdownMenu.style.display = 'none';

            usernameElement.onclick = () => {
                window.location.href = "login.html";
            };
        }
    });

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            signOut(auth).then(() => {
                console.log("User signed out.");
                window.location.href = "index.html";
            }).catch((error) => {
                console.error("Logout error:", error);
            });
        });
    }

    // Navigation menu handling
    document.querySelectorAll('.menu .nav-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.menu .nav-link').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Section navigation
    if (discoverBtn) {
        discoverBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (discoverSection) discoverSection.style.display = "block";
            if (genreSection) genreSection.style.display = "none";
            if (aboutSection) aboutSection.style.display = "none";
            if (bookmarkSection) bookmarkSection.style.display = "none";
        });
    }

    if (genreBtn) {
        genreBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (discoverSection) discoverSection.style.display = "none";
            if (aboutSection) aboutSection.style.display = "none";
            if (bookmarkSection) bookmarkSection.style.display = "none";
            if (genreSection) genreSection.style.display = "block";
        });
    }

    if (aboutBtn) {
        aboutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (discoverSection) discoverSection.style.display = "none";
            if (genreSection) genreSection.style.display = "none";
            if (bookmarkSection) bookmarkSection.style.display = "none";
            if (aboutSection) aboutSection.style.display = "block";
        });
    }

    // Bookmark navigation
    const bookmarkBtnNav = document.getElementById('bookmarkBtnNav');
    if (bookmarkBtnNav) {
        const bookDetailSection = document.getElementById('book-detail');

        bookmarkBtnNav.addEventListener('click', () => {
            // Sembunyikan semua section lain
            if (genreSection) genreSection.style.display = 'none';
            if (discoverSection) discoverSection.style.display = 'none';
            if (aboutSection) aboutSection.style.display = 'none';
            if (bookDetailSection) bookDetailSection.style.display = 'none';

            // Tampilkan bookmark section
            if (bookmarkSection) {
                bookmarkSection.style.display = 'block';
                // Muat data bookmark
                loadBookmarkedBooks();
            }
        });
    }

    // Load books by categories
    const categories = ['fantasy', 'horror', 'romance'];
    categories.forEach(category => {
        fetch(`https://openlibrary.org/subjects/${category}.json?limit=6`)
            .then(response => response.json())
            .then(data => {
                const container = document.getElementById(category);
                if (!container) return;
                
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

    // Close detail panel when clicking outside
    document.addEventListener('click', function (e) {
        const detailPanel = document.getElementById('book-detail');
        const mainWrapper = document.getElementById('main-wrapper');
        const isClickInsideDetail = detailPanel && detailPanel.contains(e.target);
        const isClickOnBook = e.target.closest('.book');

        if (!isClickInsideDetail && !isClickOnBook && detailPanel && mainWrapper) {
            mainWrapper.classList.remove('split');
            detailPanel.classList.remove('active');
        }
    });

    // Initialize reviews if available
    if (typeof renderReviews === 'function') {
        renderReviews();
    }

    // Login redirect button
    const loginRedirectBtn = document.getElementById("loginRedirectBtn");
    if (loginRedirectBtn) {
        loginRedirectBtn.addEventListener("click", function (e) {
            e.preventDefault();
            window.location.href = "login.html";
        });
    }
});

// ========== BOOK DETAIL FUNCTIONS ==========

// Show book detail dengan bookmark functionality yang konsisten
async function showDetail(image, title, author, key) {
    currentBookKey = key;
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) reviewForm.setAttribute('book-id', key);

    const detailImg = document.getElementById('detail-img');
    const detailTitle = document.getElementById('detail-title');
    const detailAuthor = document.getElementById('detail-author');
    const detailDescription = document.getElementById('detail-description');
    const mainWrapper = document.getElementById('main-wrapper');
    const bookDetail = document.getElementById('book-detail');

    if (detailImg) detailImg.src = image;
    if (detailTitle) detailTitle.textContent = title;
    if (detailAuthor) detailAuthor.textContent = author;
    if (detailDescription) detailDescription.textContent = "Loading description...";

    if (mainWrapper) mainWrapper.classList.add('split');
    if (bookDetail) bookDetail.classList.add('active');

    // Render reviews
    if (typeof renderReviews === 'function') {
        renderReviews(key);
    }

    // Fetch book description
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
            if (detailDescription) detailDescription.textContent = 'No description available.';
        });

    // Handle bookmark button dengan struktur database yang konsisten
    const bookmarkBtn = document.getElementById("bookmarkBtn");
    if (bookmarkBtn) {
        if (!currentUser) {
            bookmarkBtn.style.display = "none";
            return;
        }

        // Cek apakah buku sudah di-bookmark (konsisten dengan struktur baru)
        const bookmarkRef = collection(db, "bookmarks");
        const q = query(bookmarkRef, 
            where("userId", "==", currentUser.uid), 
            where("bookId", "==", key.replace('/works/', ''))
        );
        const querySnapshot = await getDocs(q);
        
        let isBookmarked = !querySnapshot.empty;
        let bookmarkDocId = null;
        
        if (isBookmarked) {
            bookmarkDocId = querySnapshot.docs[0].id;
        }

        bookmarkBtn.textContent = isBookmarked ? "★ Bookmarked" : "☆ Bookmark";
        bookmarkBtn.style.display = "inline-block";

        bookmarkBtn.onclick = async () => {
            if (!currentUser) return alert("Please log in to bookmark.");

            if (isBookmarked && bookmarkDocId) {
                // Hapus bookmark
                await deleteDoc(doc(db, "bookmarks", bookmarkDocId));
                bookmarkBtn.textContent = "☆ Bookmark";
                isBookmarked = false;
                bookmarkDocId = null;
            } else {
                // Tambah bookmark - hanya simpan ID (konsisten dengan Flutter)
                const bookmarkData = {
                    userId: currentUser.uid,
                    bookId: key.replace('/works/', ''),
                    createdAt: serverTimestamp()
                    // Tidak simpan title, author, image - akan diambil dari API saat load
                };
                
                const docRef = await addDoc(collection(db, "bookmarks"), bookmarkData);
                bookmarkBtn.textContent = "★ Bookmarked";
                isBookmarked = true;
                bookmarkDocId = docRef.id;
            }
        };
    }
}

// Description expand/collapse functionality
function updateDescription(description) {
    const descElement = document.getElementById('detail-description');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    if (!descElement) return;

    const maxLength = 300;
    let isExpanded = false;

    const shortDesc = description.length > maxLength
        ? description.slice(0, maxLength) + "..."
        : description;

    descElement.textContent = shortDesc;
    
    if (loadMoreBtn) {
        loadMoreBtn.style.display = description.length > maxLength ? 'inline' : 'none';
        loadMoreBtn.textContent = "Load More";

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
}

// Make functions globally available if needed
window.showDetail = showDetail;
window.loadBookmarkedBooks = loadBookmarkedBooks;
window.addBookmark = addBookmark;