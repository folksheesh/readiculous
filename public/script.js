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

window.addEventListener("DOMContentLoaded", function () {
    const usernameElement = document.getElementById('username');
    const logoutBtn = document.getElementById('logoutBtn');

    const discoverBtn = document.getElementById("discoverBtn");
    const genreBtn = document.getElementById("genreBtn");
    const aboutBtn = document.getElementById("aboutBtn");

    const discoverSection = document.getElementById("discover");
    const genreSection = document.getElementById("genre");
    const aboutSection = document.getElementById("about");

    discoverSection.style.display = "none";
    aboutSection.style.display = "none";
    genreSection.style.display = "block";

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

    logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        signOut(auth).then(() => {
            console.log("User signed out.");
            window.location.href = "index.html";
        }).catch((error) => {
            console.error("Logout error:", error);
        });
    });

    document.querySelectorAll('.menu .nav-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.menu .nav-link').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
        });
    });

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

    if (typeof renderReviews === 'function') {
        renderReviews();
    }
});

// Show book detail + bookmark dengan struktur database baru
async function showDetail(image, title, author, key) {
    currentBookKey = key;
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) reviewForm.setAttribute('book-id', key);

    document.getElementById('detail-img').src = image;
    document.getElementById('detail-title').textContent = title;
    document.getElementById('detail-author').textContent = author;
    document.getElementById('detail-description').textContent = "Loading description...";

    document.getElementById('main-wrapper').classList.add('split');
    document.getElementById('book-detail').classList.add('active');

    renderReviews(key);

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

    const bookmarkBtn = document.getElementById("bookmarkBtn");
    if (bookmarkBtn) {
        if (!currentUser) {
            bookmarkBtn.style.display = "none";
            return;
        }

        // Cek apakah buku sudah di-bookmark dengan struktur baru
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
                // Tambah bookmark dengan struktur baru
                const bookmarkData = {
                    userId: currentUser.uid,
                    bookId: key.replace('/works/', ''), // Hilangkan prefix '/works/'
                    createdAt: serverTimestamp(),
                    // Data tambahan untuk kemudahan akses
                    title: title,
                    author: author,
                    image: image
                };
                
                const docRef = await addDoc(collection(db, "bookmarks"), bookmarkData);
                bookmarkBtn.textContent = "★ Bookmarked";
                isBookmarked = true;
                bookmarkDocId = docRef.id;
            }
        };
    }
}

function updateDescription(description) {
    const descElement = document.getElementById('detail-description');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    const maxLength = 300;
    let isExpanded = false;

    const shortDesc = description.length > maxLength
        ? description.slice(0, maxLength) + "..."
        : description;

    descElement.textContent = shortDesc;
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

const loginRedirectBtn = document.getElementById("loginRedirectBtn");
if (loginRedirectBtn) {
    loginRedirectBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.location.href = "login.html";
    });
}

// Updated bookmark navigation dengan struktur database baru
const bookmarkBtnNav = document.getElementById('bookmarkBtnNav');
if (bookmarkBtnNav) {
    const bookmarkSection = document.getElementById('bookmark');
    const genreSection = document.getElementById('genre');
    const discoverSection = document.getElementById('discover');
    const aboutSection = document.getElementById('about');
    const bookDetailSection = document.getElementById('book-detail');

    bookmarkBtnNav.addEventListener('click', () => {
        // Sembunyikan semua section lain
        genreSection.style.display = 'none';
        discoverSection.style.display = 'none';
        aboutSection.style.display = 'none';
        if (bookDetailSection) bookDetailSection.style.display = 'none';

        // Tampilkan bookmark section
        if (bookmarkSection) {
            bookmarkSection.style.display = 'block';
            // Muat data bookmark
            loadBookmarkedBooks();
        }
    });
}

// Updated loadBookmarkedBooks function dengan struktur database baru
// Updated loadBookmarkedBooks function dengan layout yang lebih konsisten
async function loadBookmarkedBooks() {
    const user = auth.currentUser;
    const bookmarkList = document.getElementById('bookmark-list');
    
    if (!bookmarkList) return;
    bookmarkList.innerHTML = '';

    if (!user) {
        bookmarkList.innerHTML = `
            <div class="col-12">
                <div class="text-center p-5">
                    <p class="text-muted fs-5">Please log in to view your bookmarks.</p>
                    <a href="login.html" class="btn btn-primary">Login Now</a>
                </div>
            </div>`;
        return;
    }

    try {
        // Query bookmarks dengan struktur baru
        const bookmarkRef = collection(db, 'bookmarks');
        const q = query(bookmarkRef, where("userId", "==", user.uid));
        const bookmarkSnap = await getDocs(q);

        if (bookmarkSnap.empty) {
            bookmarkList.innerHTML = `
                <div class="col-12">
                    <div class="text-center p-5">
                        <i class="bi bi-bookmark-heart display-1 text-muted mb-3"></i>
                        <p class="text-muted fs-5">You haven't bookmarked any books yet.</p>
                        <p class="text-muted">Start exploring books and bookmark your favorites!</p>
                    </div>
                </div>`;
            return;
        }

        bookmarkSnap.forEach((docSnap) => {
            const book = docSnap.data();
            const docId = docSnap.id;

            // Gunakan grid Bootstrap yang konsisten
            const col = document.createElement('div');
            col.className = 'col-xl-3 col-lg-4 col-md-6 col-sm-12 mb-4';
            col.innerHTML = `
                <div class="card h-100 shadow-sm">
                    <img src="${book.image || 'https://via.placeholder.com/180x250/37295a/ffffff?text=No+Image'}" 
                         class="card-img-top" 
                         alt="${book.title}"
                         loading="lazy">
                    <div class="card-body">
                        <h5 class="card-title">${book.title}</h5>
                        <p class="card-text text-muted">by ${book.author}</p>
                        <div class="d-flex gap-2 mt-auto">
                            <button class="btn btn-outline-primary flex-fill view-detail-btn" 
                                    data-book-id="${book.bookId}" 
                                    data-title="${book.title}" 
                                    data-author="${book.author}" 
                                    data-image="${book.image}">
                                <i class="bi bi-eye me-1"></i>View
                            </button>
                            <button class="btn btn-outline-danger delete-bookmark-btn" 
                                    data-doc-id="${docId}"
                                    title="Remove from bookmarks">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            bookmarkList.appendChild(col);
        });

        // Event untuk tombol "View Details"
        document.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const bookId = btn.getAttribute('data-book-id');
                const title = btn.getAttribute('data-title');
                const author = btn.getAttribute('data-author');
                const image = btn.getAttribute('data-image');
                
                // Panggil showDetail dengan data bookmark
                showDetail(image, title, author, `/works/${bookId}`);
            });
        });

        // Event untuk tombol "Remove" dengan konfirmasi
        document.querySelectorAll('.delete-bookmark-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const docId = btn.getAttribute('data-doc-id');
                
                // Tambahkan konfirmasi sebelum menghapus
                if (confirm('Are you sure you want to remove this book from your bookmarks?')) {
                    try {
                        // Tambahkan loading state pada tombol
                        btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
                        btn.disabled = true;
                        
                        await deleteDoc(doc(db, 'bookmarks', docId));
                        loadBookmarkedBooks(); // Refresh setelah hapus
                    } catch (error) {
                        console.error('Error removing bookmark:', error);
                        alert('Failed to remove bookmark. Please try again.');
                        
                        // Restore tombol jika gagal
                        btn.innerHTML = '<i class="bi bi-trash"></i>';
                        btn.disabled = false;
                    }
                }
            });
        });

    } catch (error) {
        console.error('Error loading bookmarks:', error);
        bookmarkList.innerHTML = `
            <div class="col-12">
                <div class="text-center p-5">
                    <i class="bi bi-exclamation-triangle display-1 text-warning mb-3"></i>
                    <p class="text-muted fs-5">Error loading bookmarks.</p>
                    <button class="btn btn-primary" onclick="loadBookmarkedBooks()">Try Again</button>
                </div>
            </div>`;
    }
}

