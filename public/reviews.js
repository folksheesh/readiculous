import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { addDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Global for username
let currentUsername = "Guest";

// Inisialisasi user info sekali di sini
onAuthStateChanged(window.auth, (user) => {
    currentUsername = user?.displayName || user?.email || "Guest";
});

// Public function untuk dipanggil dari luar
export async function renderReviews(bookId) {
    const reviewList = document.getElementById('review-list');
    const noReviewMsg = document.getElementById('no-review-msg');
    reviewList.innerHTML = '';
    if (noReviewMsg) noReviewMsg.style.display = 'none';

    if (!bookId) {
        console.error("Book ID is not set");
        return;
    }

    try {
        const q = query(collection(window.db, "reviews"), where("bookId", "==", bookId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log('No reviews found for this book');
            if (noReviewMsg) noReviewMsg.style.display = 'block';
        } else {
            querySnapshot.forEach((doc) => {
                const r = doc.data();
                const div = document.createElement('div');
                div.className = 'review-item mb-3';
                div.innerHTML = `
                    <div class="card-review p-3 border rounded bg-light">
                        <div class="review-header d-flex justify-content-between">
                            <span class="review-name fw-bold">${r.name}</span>
                            <span class="review-date text-muted">${r.date}</span>
                        </div>
                        <div class="review-text mt-2">${r.text}</div>
                    </div>
                `;
                reviewList.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error getting reviews: ", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleForm');
    const reviewFormContainer = document.getElementById('reviewFormContainer');
    const reviewForm = document.getElementById('reviewForm');
    const reviewText = document.getElementById('reviewText');

    // Toggle Form
    if (toggleBtn && reviewFormContainer) {
        toggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            reviewFormContainer.style.display =
                reviewFormContainer.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Submit Review
    if (reviewForm) {
        reviewForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (currentUsername === "Guest") {
                // Tampilkan modal login jika belum login
                const modal = new bootstrap.Modal(document.getElementById('loginModal'));
                modal.show();
                return;
            }

            const text = reviewText.value.trim();
            if (!text) return;

            const date = new Date().toISOString().split('T')[0];
            const bookId = reviewForm.getAttribute('book-id');

            if (!bookId) {
                console.error("bookId is empty!");
                return;
            }

            try {
                await addDoc(collection(window.db, "reviews"), {
                    bookId,
                    name: currentUsername,
                    date,
                    text
                });

                reviewText.value = '';
                reviewFormContainer.style.display = 'none';
                renderReviews(bookId); // Refresh review
            } catch (error) {
                console.error("Error adding review: ", error);
            }
        });
    }
});
