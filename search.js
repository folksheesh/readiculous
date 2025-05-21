import { renderReviews } from './reviews.js';

const allBooks = [];
const categories = ['fantasy', 'horror', 'romance'];
const searchResults = document.getElementById('searchResults');

let currentBookKey = null;


function renderBook(book, coverUrl, author) {
  const bookElement = document.createElement('div');
  bookElement.classList.add('text-center', 'book');
  bookElement.style.cursor = 'pointer';
  bookElement.innerHTML = `
    <img src="${coverUrl}" class="rounded shadow-sm mb-2" style="width: 140px; height: 220px; object-fit: cover;">
    <p class="small text-muted">${author}</p>
    <p class="small fw-semibold mb-0">${book.title}</p>
  `;

  bookElement.addEventListener('click', (e) => {
    e.stopPropagation(); 
    showDetail(coverUrl, book.title, author, book.key);
  });

  return bookElement;
}


function addToBookList(book, coverUrl) {
  const author = book.authors?.map(a => a.name).join(', ') || 'Unknown Author';
  const element = renderBook(book, coverUrl, author);

  const bookData = {
    title: book.title.toLowerCase(),
    author: author.toLowerCase(),
    key: book.key,
    image: coverUrl,
    element
  };

  element.addEventListener('click', () => {
    showDetail(coverUrl, book.title, author, book.key);
  });

  allBooks.push(bookData);
}


function displayResults(keyword) {
  searchResults.innerHTML = '';
  const lowerKeyword = keyword.toLowerCase();

  allBooks.forEach(book => {
    if (book.title.includes(lowerKeyword) || book.author.includes(lowerKeyword)) {
      const clone = book.element.cloneNode(true);
      clone.addEventListener('click', () => {
        showDetail(book.image, book.title, book.author, book.key);
      });
      searchResults.appendChild(clone);
    }
  });
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  displayResults(e.target.value);
});

// Fetch books on load
categories.forEach(category => {
  fetch(`https://openlibrary.org/subjects/${category}.json?limit=20`)
    .then(res => res.json())
    .then(data => {
      data.works.forEach(book => {
        const coverUrl = book.cover_id
          ? `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`
          : 'https://via.placeholder.com/140x200?text=No+Image';
        addToBookList(book, coverUrl);
      });
    })
    .catch(err => console.error('Failed to fetch books:', err));
});

// Fungsi untuk menampilkan detail buku
function showDetail(image, title, author, key) {
  currentBookKey = key;

  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
      reviewForm.setAttribute('book-id', key);  // Set book-id in the review form
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

  // Load reviews
  if (typeof renderReviews === 'function') {
      renderReviews(key);
  }

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

// Tutup panel detail jika klik di luar
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
