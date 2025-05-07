import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { renderReviews } from './reviews.js';


let currentBookKey = null; // To store the current book key globally

// Update user info on authentication state change
onAuthStateChanged(auth, (user) => {
    const username = user ? (user.displayName || user.email) : 'Guest';
    document.getElementById("username").textContent = `Hi, ${username}`;
});

// Menu active link toggle
document.querySelectorAll('.menu .nav-link').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.menu .nav-link').forEach(el => el.classList.remove('active'));
        this.classList.add('active');
    });
});

// Show book details and fetch its description
function showDetail(image, title, author, key) {
    currentBookKey = key;
    console.log('Current Book Key:', currentBookKey);

    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.setAttribute('book-id', key);  // Set book-id in the review form
        console.log('Review Form found, book-id set to:', key);
    } else {
        console.error('Review Form not found!');
    }

    // Update book detail UI
    document.getElementById('detail-img').src = image;
    document.getElementById('detail-title').textContent = title;
    document.getElementById('detail-author').textContent = author;
    document.getElementById('detail-description').textContent = "Loading description...";

    document.getElementById('main-wrapper').classList.add('split');
    document.getElementById('book-detail').classList.add('active');

    renderReviews(key); // Load reviews for the book

    // Fetch book description from OpenLibrary API
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


// Update book description with "Read More/Read Less" functionality
function updateDescription(desc) {
    const maxLength = 250;
    const descElem = document.getElementById('detail-description');
    if (desc.length > maxLength) {
        const shortDesc = desc.slice(0, maxLength) + '...';

        descElem.innerHTML = `
            <span id="desc-text">${shortDesc}</span>
            <button id="toggle-desc" style="background:none;border:none;color:wheat;cursor:pointer;">Read More</button>
        `;

        let expanded = false;
        document.getElementById('toggle-desc').addEventListener('click', () => {
            expanded = !expanded;
            document.getElementById('desc-text').textContent = expanded ? desc : shortDesc;
            document.getElementById('toggle-desc').textContent = expanded ? 'Read Less' : 'Read More';
        });
    } else {
        descElem.textContent = desc;
    }
}

// Fetch books from categories and display
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
                    e.stopPropagation(); // Prevent closing detail panel
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

// Ensure renderReviews function is called if defined
if (typeof renderReviews === 'function') {
    renderReviews();
}


console.log('Review Form:', reviewForm);
console.log('Book ID at submit:', reviewForm ? reviewForm.getAttribute('book-id') : 'No book-id');
