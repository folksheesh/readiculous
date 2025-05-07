const allBooks = [];
const categories = ['fantasy', 'horror', 'romance'];
const searchResults = document.getElementById('searchResults');

function renderBook(book, coverUrl) {
  const bookElement = document.createElement('div');
  bookElement.className = 'col-md-2 text-center book';
  bookElement.innerHTML = `
    <img src="${coverUrl}" class="img-fluid rounded shadow-sm mb-2" style="height: 200px; object-fit: cover;">
    <p class="small text-muted">${book.authors?.map(a => a.name).join(', ') || 'Unknown Author'}</p>
    <p class="small fw-semibold mb-0">${book.title}</p>
  `;
  return bookElement;
}

function addToBookList(book, coverUrl) {
  const author = book.authors?.map(a => a.name).join(', ') || 'Unknown Author';
  const element = renderBook(book, coverUrl);

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
  document.getElementById('detail-img').src = image;
  document.getElementById('detail-title').textContent = title;
  document.getElementById('detail-author').textContent = author;
  document.getElementById('detail-description').textContent = "Loading description...";

  document.getElementById('main-wrapper').classList.add('split');
  document.getElementById('book-detail').classList.add('active');

  fetch(`https://openlibrary.org${key}.json`)
    .then(res => res.json())
    .then(data => {
      const desc = typeof data.description === 'string'
        ? data.description
        : data.description?.value || 'No description available.';
      document.getElementById('detail-description').textContent = desc;
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
