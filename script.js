// Import Firebase and required methods
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
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

// Show book detail + bookmark
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

        const userDocRef = doc(db, "bookmarks", `${currentUser.uid}_${key}`);
        const docSnap = await getDoc(userDocRef);

        let isBookmarked = docSnap.exists();
        bookmarkBtn.textContent = isBookmarked ? "★ Bookmarked" : "☆ Bookmark";
        bookmarkBtn.style.display = "inline-block";

        bookmarkBtn.onclick = async () => {
            if (!currentUser) return alert("Please log in to bookmark.");

            if (isBookmarked) {
                await deleteDoc(userDocRef);
                bookmarkBtn.textContent = "☆ Bookmark";
                isBookmarked = false;
            } else {
                await setDoc(userDocRef, {
                    userId: currentUser.uid,
                    bookKey: key,
                    title,
                    author,
                    image,
                    timestamp: Date.now()
                });
                bookmarkBtn.textContent = "★ Bookmarked";
                isBookmarked = true;
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
const bookmarkBtnNav = document.getElementById('bookmarkBtnNav');
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
  bookDetailSection.style.display = 'none';

  // Tampilkan bookmark section
  bookmarkSection.style.display = 'block';

  // Muat data bookmark
  loadBookmarkedBooks();
});

async function loadBookmarkedBooks() {
  const user = auth.currentUser;
  const bookmarkList = document.getElementById('bookmark-list');
  bookmarkList.innerHTML = '';

  if (!user) return;

  const bookmarkRef = collection(db, 'users', user.uid, 'bookmarks');
  const bookmarkSnap = await getDocs(bookmarkRef);

  if (bookmarkSnap.empty) {
    bookmarkList.innerHTML = `<p class="text-white">You haven't bookmarked any books yet.</p>`;
    return;
  }

  bookmarkSnap.forEach((docSnap) => {
    const book = docSnap.data();
    const docId = docSnap.id;

    const col = document.createElement('div');
    col.className = 'col-md-3';
    col.innerHTML = `
      <div class="card h-100">
        <img src="${book.image}" class="card-img-top" alt="${book.title}">
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <h5 class="card-title">${book.title}</h5>
            <p class="card-text text-muted">${book.author}</p>
          </div>
          <div class="d-flex justify-content-between mt-3">
            <button class="btn btn-sm btn-outline-primary view-detail-btn" data-id="${book.id}">View Details</button>
            <button class="btn btn-sm btn-outline-danger delete-bookmark-btn" data-doc-id="${docId}">Remove</button>
          </div>
        </div>
      </div>
    `;
    bookmarkList.appendChild(col);
  });

  // Event untuk tombol "View Details"
  document.querySelectorAll('.view-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bookId = btn.getAttribute('data-id');
      showBookDetail(bookId); // Pastikan fungsi ini sudah tersedia
    });
  });

  // Event untuk tombol "Remove"
  document.querySelectorAll('.delete-bookmark-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.getAttribute('data-doc-id');
      await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', docId));
      loadBookmarkedBooks(); // Refresh setelah hapus
    });
  });
}
