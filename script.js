document.querySelectorAll('.menu .nav-link').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.menu .nav-link').forEach(el => el.classList.remove('active'));
        this.classList.add('active');
    });
});

const categories = ['fantasy', 'horror', 'romance'];

function showDetail(image, title, author, key) {
    document.getElementById('detail-img').src = image;
    document.getElementById('detail-title').textContent = title;
    document.getElementById('detail-author').textContent = author;
    document.getElementById('detail-description').textContent = "Loading description...";

    document.getElementById('main-wrapper').classList.add('split');
    document.getElementById('book-detail').classList.add('active');

    console.log('Kelas "active" ditambahkan pada book-detail:', document.getElementById('book-detail').classList.contains('active'));

    // Fetch book detail description
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

// Fetch and render books
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
                    e.stopPropagation(); // prevent closing detail
                    showDetail(coverUrl, title, author, book.key);
                });

                container.appendChild(bookElement);
            });
        })
        .catch(error => console.error('Error fetching books:', error));
});

// Close detail when clicking outside
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

