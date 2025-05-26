import { onAuthStateChanged, getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { addDoc, collection, getDocs, query, where, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Global variable
let currentUsername = "Guest";
let currentUserRole = null;
const auth = getAuth();

// Cek auth & role
onAuthStateChanged(window.auth, async (user) => {
  if (user) {
    currentUsername = user.displayName || user.email || "Guest";
    const uid = user.uid;

    // Cek dari koleksi ADMIN
    const adminDoc = await getDoc(doc(window.db, "ADMIN", uid));
    if (adminDoc.exists()) {
      currentUserRole = adminDoc.data().role || null;
      console.log("Role ditemukan di ADMIN:", currentUserRole);
    } else {
      // Cek dari koleksi users
      const userDoc = await getDoc(doc(window.db, "users", uid));
      if (userDoc.exists()) {
        currentUserRole = userDoc.data().role || null;
        console.log("Role ditemukan di users:", currentUserRole);
      } else {
        currentUserRole = null;
        console.log("User tidak ditemukan di Firestore.");
      }
    }

    // Setelah role terdeteksi, render review
    const reviewForm = document.getElementById('reviewForm');
    const bookId = reviewForm?.getAttribute('book-id');
    if (bookId) {
      renderReviews(bookId);
    }

  } else {
    currentUserRole = null;
    currentUsername = "Guest";
    console.log("Tidak ada user login.");
  }
});

// Fungsi render review
export async function renderReviews(bookId) {
  const reviewList = document.getElementById('review-list');
  const noReviewMsg = document.getElementById('no-review-msg');
  reviewList.innerHTML = '';
  if (noReviewMsg) noReviewMsg.style.display = 'none';

  if (!bookId) {
    console.error("Book ID is not set");
    return;
  }

  console.log("Render reviews sebagai:", currentUserRole);

  try {
    const q = query(collection(window.db, "reviews"), where("bookId", "==", bookId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      if (noReviewMsg) noReviewMsg.style.display = 'block';
    } else {
      querySnapshot.forEach((docSnap) => {
        const r = docSnap.data();
        const reviewId = docSnap.id;

        const div = document.createElement('div');
        div.className = 'review-item mb-3';

        let deleteButtonHTML = '';
        if (currentUserRole === 'admin') {
          deleteButtonHTML = `
            <button class="btn btn-sm btn-danger delete-review-btn mt-2" data-id="${reviewId}">
              Hapus
            </button>`;
        }

        div.innerHTML = `
          <div class="card-review p-3 border rounded bg-light">
            <div class="review-header d-flex justify-content-between">
              <span class="review-name fw-bold">${r.name}</span>
              <span class="review-date text-muted">${r.date}</span>
            </div>
            <div class="review-text mt-2">${r.text}</div>
            ${deleteButtonHTML}
          </div>
        `;

        reviewList.appendChild(div);
      });

      // Event handler delete
      document.querySelectorAll('.delete-review-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          const reviewId = this.getAttribute('data-id');
          if (confirm("Yakin ingin menghapus review ini?")) {
            await deleteDoc(doc(window.db, "reviews", reviewId));
            renderReviews(bookId);
          }
        });
      });
    }
  } catch (error) {
    console.error("Error getting reviews: ", error);
  }
}

// Event submit dan toggle form
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleForm');
  const reviewFormContainer = document.getElementById('reviewFormContainer');
  const reviewForm = document.getElementById('reviewForm');
  const reviewText = document.getElementById('reviewText');

  if (toggleBtn && reviewFormContainer) {
    toggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      reviewFormContainer.style.display =
        reviewFormContainer.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (currentUsername === "Guest") {
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
        renderReviews(bookId);
      } catch (error) {
        console.error("Error adding review: ", error);
      }
    });
  }
});
