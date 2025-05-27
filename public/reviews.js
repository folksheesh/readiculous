// Enhanced reviews.js with Admin Love Feature
import { onAuthStateChanged, getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { addDoc, collection, getDocs, query, where, deleteDoc, doc, getDoc, orderBy, serverTimestamp, updateDoc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Global variables
let currentUsername = "Guest";
let currentUserRole = null;
let currentUserId = null;
const auth = getAuth();

// Check auth & role
onAuthStateChanged(window.auth, async (user) => {
  if (user) {
    currentUsername = user.displayName || user.email || "Guest";
    currentUserId = user.uid;

    // Check from ADMIN collection
    const adminDoc = await getDoc(doc(window.db, "ADMIN", currentUserId));
    if (adminDoc.exists()) {
      currentUserRole = adminDoc.data().role || 'admin';
      console.log("Role found in ADMIN:", currentUserRole);
    } else {
      // Check from users collection
      const userDoc = await getDoc(doc(window.db, "users", currentUserId));
      if (userDoc.exists()) {
        currentUserRole = userDoc.data().role || null;
        console.log("Role found in users:", currentUserRole);
      } else {
        currentUserRole = null;
        console.log("User not found in Firestore.");
        
        // Create user profile if doesn't exist
        await createUserProfile(currentUserId, currentUsername, user.email);
      }
    }

    // After role detection, render reviews
    const reviewForm = document.getElementById('reviewForm');
    const bookId = reviewForm?.getAttribute('book-id');
    if (bookId) {
      renderReviews(bookId);
    }

  } else {
    currentUserRole = null;
    currentUsername = "Guest";
    currentUserId = null;
    console.log("No user logged in.");
  }
});

// Create user profile
async function createUserProfile(userId, userName, email) {
  try {
    await setDoc(doc(window.db, "users", userId), {
      userName: userName,
      email: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("User profile created for:", userId);
  } catch (error) {
    console.error("Error creating user profile:", error);
  }
}

// ========== NEW: ADMIN LOVE SYSTEM ==========

// Function to toggle love on a review (Admin only)
async function toggleReviewLove(reviewId, bookId) {
  if (currentUserRole !== 'admin') {
    alert("Hanya admin yang dapat memberikan love pada review.");
    return;
  }

  try {
    const reviewRef = doc(window.db, "reviews", reviewId);
    const reviewSnap = await getDoc(reviewRef);
    
    if (!reviewSnap.exists()) {
      alert("Review tidak ditemukan.");
      return;
    }

    const reviewData = reviewSnap.data();
    const currentLoves = reviewData.adminLoves || [];
    const isLoved = currentLoves.includes(currentUserId);

    let updatedLoves;
    let action;

    if (isLoved) {
      // Remove love
      updatedLoves = currentLoves.filter(id => id !== currentUserId);
      action = "removed";
    } else {
      // Add love
      updatedLoves = [...currentLoves, currentUserId];
      action = "added";
    }

    // Update review document
    await updateDoc(reviewRef, {
      adminLoves: updatedLoves,
      adminLoveCount: updatedLoves.length,
      updatedAt: serverTimestamp()
    });

    console.log(`Admin love ${action} for review ${reviewId}`);
    
    // Update UI immediately
    updateLoveButtonUI(reviewId, !isLoved, updatedLoves.length);
    
    // Show success message
    const message = isLoved ? "Love dihapus dari review!" : "Love diberikan pada review!";
    showTemporaryMessage(message, "success");

  } catch (error) {
    console.error("Error toggling review love:", error);
    alert("Gagal mengubah status love: " + error.message);
  }
}

// Update love button UI
function updateLoveButtonUI(reviewId, isLoved, loveCount) {
  const loveBtn = document.getElementById(`love-btn-${reviewId}`);
  const loveCountSpan = document.getElementById(`love-count-${reviewId}`);
  
  if (loveBtn) {
    loveBtn.innerHTML = isLoved ? '❤️ Loved' : '🤍 Love';
    loveBtn.className = isLoved ? 
      'btn btn-sm btn-danger admin-love-btn' : 
      'btn btn-sm btn-outline-danger admin-love-btn';
  }
  
  if (loveCountSpan) {
    loveCountSpan.textContent = loveCount > 0 ? `${loveCount} love${loveCount > 1 ? 's' : ''}` : '';
    loveCountSpan.style.display = loveCount > 0 ? 'inline' : 'none';
  }
}

// Show temporary message
function showTemporaryMessage(message, type = 'info') {
  // Remove existing messages
  const existingMsg = document.getElementById('temp-message');
  if (existingMsg) existingMsg.remove();

  const msgDiv = document.createElement('div');
  msgDiv.id = 'temp-message';
  msgDiv.className = `alert alert-${type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
  msgDiv.style.position = 'fixed';
  msgDiv.style.top = '20px';
  msgDiv.style.right = '20px';
  msgDiv.style.zIndex = '9999';
  msgDiv.style.minWidth = '300px';
  
  msgDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <span class="me-2">${type === 'success' ? '✅' : 'ℹ️'}</span>
      <span>${message}</span>
      <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
    </div>
  `;
  
  document.body.appendChild(msgDiv);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (msgDiv && msgDiv.parentNode) {
      msgDiv.remove();
    }
  }, 3000);
}

// Function to delete all reviews for a specific book (Admin only)
async function deleteAllReviews(bookId) {
  if (currentUserRole !== 'admin') {
    alert("Akses ditolak. Hanya admin yang dapat menghapus semua review.");
    return;
  }

  const confirmDelete = confirm(
    "⚠️ PERINGATAN ⚠️\n\n" +
    "Anda akan menghapus SEMUA review untuk buku ini!\n" +
    "Tindakan ini tidak dapat dibatalkan.\n\n" +
    "Apakah Anda yakin ingin melanjutkan?"
  );

  if (!confirmDelete) return;

  // Double confirmation for safety
  const doubleConfirm = confirm(
    "Konfirmasi kedua:\n\n" +
    "Anda benar-benar yakin ingin menghapus SEMUA review?\n" +
    "Ketik 'DELETE' di prompt berikutnya untuk melanjutkan."
  );

  if (!doubleConfirm) return;

  const finalConfirm = prompt(
    "Ketik 'DELETE' (huruf besar) untuk mengkonfirmasi penghapusan semua review:"
  );

  if (finalConfirm !== 'DELETE') {
    alert("Penghapusan dibatalkan. Input tidak sesuai.");
    return;
  }

  try {
    console.log("Admin deleting all reviews for book:", bookId);
    
    // Get all reviews for this book
    const bookIdVariants = [
      bookId,
      `/works/${bookId}`,
      bookId.replace('/works/', '')
    ];

    let reviewsToDelete = [];

    for (const variant of bookIdVariants) {
      try {
        const q = query(collection(window.db, "reviews"), where("bookId", "==", variant));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((docSnap) => {
          if (!reviewsToDelete.some(r => r.id === docSnap.id)) {
            reviewsToDelete.push({
              id: docSnap.id,
              ...docSnap.data()
            });
          }
        });
      } catch (error) {
        console.log(`Error querying reviews for ${variant}:`, error);
      }
    }

    if (reviewsToDelete.length === 0) {
      alert("Tidak ada review yang ditemukan untuk dihapus.");
      return;
    }

    console.log(`Found ${reviewsToDelete.length} reviews to delete`);

    // Show progress
    const progressDiv = document.createElement('div');
    progressDiv.id = 'delete-progress';
    progressDiv.innerHTML = `
      <div class="alert alert-warning mt-3">
        <strong>Menghapus reviews...</strong>
        <div class="progress mt-2">
          <div class="progress-bar" role="progressbar" style="width: 0%"></div>
        </div>
        <small>0 / ${reviewsToDelete.length} review dihapus</small>
      </div>
    `;
    
    const reviewsContainer = document.querySelector('.reviews');
    if (reviewsContainer) {
      reviewsContainer.insertBefore(progressDiv, reviewsContainer.firstChild);
    }

    // Use batch delete for better performance
    const batchSize = 500;
    let deletedCount = 0;

    for (let i = 0; i < reviewsToDelete.length; i += batchSize) {
      const batch = writeBatch(window.db);
      const batchReviews = reviewsToDelete.slice(i, i + batchSize);

      batchReviews.forEach((review) => {
        const reviewRef = doc(window.db, "reviews", review.id);
        batch.delete(reviewRef);
      });

      await batch.commit();
      deletedCount += batchReviews.length;

      // Update progress
      const progress = Math.round((deletedCount / reviewsToDelete.length) * 100);
      const progressBar = document.querySelector('#delete-progress .progress-bar');
      const progressText = document.querySelector('#delete-progress small');
      
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressText) progressText.textContent = `${deletedCount} / ${reviewsToDelete.length} review dihapus`;
    }

    // Remove progress indicator
    if (progressDiv) progressDiv.remove();

    console.log(`Successfully deleted ${deletedCount} reviews`);
    alert(`✅ Berhasil menghapus ${deletedCount} review!`);

    // Refresh reviews display
    renderReviews(bookId);

  } catch (error) {
    console.error("Error deleting all reviews:", error);
    alert(`❌ Gagal menghapus review: ${error.message}`);
    
    const progressDiv = document.getElementById('delete-progress');
    if (progressDiv) progressDiv.remove();
  }
}

// ========== ENHANCED RENDER REVIEWS FUNCTION ==========

// Function to render reviews with admin love feature
export async function renderReviews(bookId) {
  const reviewList = document.getElementById('review-list');
  const noReviewMsg = document.getElementById('no-review-msg');
  reviewList.innerHTML = '';
  if (noReviewMsg) noReviewMsg.style.display = 'none';

  if (!bookId) {
    console.error("Book ID is not set");
    return;
  }

  console.log("=== RENDERING REVIEWS WITH LOVE FEATURE ===");
  console.log("Book ID:", bookId);
  console.log("Current user role:", currentUserRole);
  console.log("Firebase db:", window.db);

  if (!window.db) {
    console.error("Firebase database not initialized!");
    return;
  }

  try {
    console.log("Attempting to query reviews...");
    
    const bookIdVariants = [
      bookId,
      `/works/${bookId}`,
      bookId.replace('/works/', '')
    ];
    
    console.log("BookId variants to search:", bookIdVariants);
    
    let allReviews = [];
    for (const variant of bookIdVariants) {
      try {
        const q = query(
          collection(window.db, "reviews"), 
          where("bookId", "==", variant),
          orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        console.log(`Query for bookId "${variant}" found ${querySnapshot.size} reviews`);
        
        querySnapshot.forEach((docSnap) => {
          if (!allReviews.some(r => r.id === docSnap.id)) {
            allReviews.push({
              id: docSnap.id,
              ...docSnap.data()
            });
          }
        });
      } catch (orderError) {
        console.log(`OrderBy failed for ${variant}, trying without orderBy...`);
        try {
          const simpleQ = query(
            collection(window.db, "reviews"), 
            where("bookId", "==", variant)
          );
          const simpleSnapshot = await getDocs(simpleQ);
          
          simpleSnapshot.forEach((docSnap) => {
            if (!allReviews.some(r => r.id === docSnap.id)) {
              allReviews.push({
                id: docSnap.id,
                ...docSnap.data()
              });
            }
          });
        } catch (simpleError) {
          console.log(`Simple query also failed for ${variant}:`, simpleError);
        }
      }
    }
    
    console.log("Total unique reviews found:", allReviews.length);
    
    // Sort reviews by love count first (admin loved reviews on top), then by date
    allReviews.sort((a, b) => {
      const aLoveCount = a.adminLoveCount || 0;
      const bLoveCount = b.adminLoveCount || 0;
      
      // If love counts are different, prioritize higher love count
      if (aLoveCount !== bLoveCount) {
        return bLoveCount - aLoveCount;
      }
      
      // If love counts are same, sort by date (newest first)
      const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
      const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
      return dateB - dateA;
    });

    // Add admin controls if admin and reviews exist
    if (currentUserRole === 'admin' && allReviews.length > 0) {
      const totalLoves = allReviews.reduce((sum, review) => sum + (review.adminLoveCount || 0), 0);
      
      const adminControlsDiv = document.createElement('div');
      adminControlsDiv.id = 'admin-controls';
      adminControlsDiv.className = 'mb-4 p-3 border rounded bg-danger bg-opacity-10';
      adminControlsDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <h6 class="text-danger mb-1">🛡️ Admin Controls</h6>
            <small class="text-muted">
              Total reviews: ${allReviews.length} | 
              Total admin loves: ${totalLoves}
            </small>
          </div>
          <button id="deleteAllReviewsBtn" class="btn btn-danger btn-sm">
            🗑️ Hapus Semua Review
          </button>
        </div>
        <div class="admin-stats p-2 bg-white rounded">
          <div class="row text-center">
            <div class="col-4">
              <div class="fw-bold text-primary">${allReviews.filter(r => (r.adminLoveCount || 0) > 0).length}</div>
              <small class="text-muted">Loved Reviews</small>
            </div>
            <div class="col-4">
              <div class="fw-bold text-success">${allReviews.length}</div>
              <small class="text-muted">Total Reviews</small>
            </div>
            <div class="col-4">
              <div class="fw-bold text-warning">${totalLoves}</div>
              <small class="text-muted">Total Loves</small>
            </div>
          </div>
        </div>
      `;
      
      reviewList.appendChild(adminControlsDiv);

      // Add event listener for delete all button
      const deleteAllBtn = document.getElementById('deleteAllReviewsBtn');
      if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
          deleteAllReviews(bookId);
        });
      }
    }

    if (allReviews.length === 0) {
      console.log("No reviews found for any bookId variant");
      if (noReviewMsg) noReviewMsg.style.display = 'block';
    } else {
      console.log("Processing", allReviews.length, "unique reviews");
      
      allReviews.forEach((reviewData) => {
        console.log("Review data:", reviewData);
        
        const div = document.createElement('div');
        div.className = 'review-item mb-3';

        // Handle date formatting
        let displayDate = 'Unknown date';
        if (reviewData.createdAt) {
          try {
            if (reviewData.createdAt.toDate) {
              displayDate = reviewData.createdAt.toDate().toLocaleDateString();
            } else if (reviewData.createdAt.seconds) {
              displayDate = new Date(reviewData.createdAt.seconds * 1000).toLocaleDateString();
            } else if (typeof reviewData.createdAt === 'string') {
              displayDate = new Date(reviewData.createdAt).toLocaleDateString();
            }
          } catch (e) {
            console.log("Date parsing error:", e);
            displayDate = 'Invalid date';
          }
        }

        // Show edited indicator
        let editedIndicator = '';
        if (reviewData.updatedAt && reviewData.createdAt) {
          try {
            const createdTime = reviewData.createdAt.seconds || 0;
            const updatedTime = reviewData.updatedAt.seconds || 0;
            if (updatedTime > createdTime + 60) {
              editedIndicator = ' <small class="text-muted">(diedit)</small>';
            }
          } catch (e) {
            console.log("Error checking edit status:", e);
          }
        }

        // NEW: Love system data
        const adminLoves = reviewData.adminLoves || [];
        const loveCount = reviewData.adminLoveCount || 0;
        const isLovedByCurrentAdmin = currentUserRole === 'admin' && adminLoves.includes(currentUserId);

        // NEW: Admin love button (only for admin)
        let adminLoveHTML = '';
        if (currentUserRole === 'admin') {
          adminLoveHTML = `
            <div class="admin-love-section mt-2 mb-2">
              <button id="love-btn-${reviewData.id}" 
                      class="btn btn-sm ${isLovedByCurrentAdmin ? 'btn-danger' : 'btn-outline-danger'} admin-love-btn me-2" 
                      data-review-id="${reviewData.id}">
                ${isLovedByCurrentAdmin ? '❤️ Loved' : '🤍 Love'}
              </button>
              <span id="love-count-${reviewData.id}" class="text-muted small" style="display: ${loveCount > 0 ? 'inline' : 'none'}">
                ${loveCount > 0 ? `${loveCount} love${loveCount > 1 ? 's' : ''}` : ''}
              </span>
            </div>
          `;
        } else if (loveCount > 0) {
          // Show love count to regular users if there are loves
          adminLoveHTML = `
            <div class="love-display mt-2 mb-2">
              <span class="text-danger">❤️</span>
              <span class="text-muted small ms-1">${loveCount} admin love${loveCount > 1 ? 's' : ''}</span>
            </div>
          `;
        }

        // Show edit and delete buttons for admin or review owner
        let actionButtonsHTML = '';
        if (currentUserRole === 'admin' || (currentUserId && reviewData.userId === currentUserId)) {
          const isAdmin = currentUserRole === 'admin';
          const adminBadge = isAdmin ? ' <span class="badge bg-danger ms-1">Admin</span>' : '';
          
          actionButtonsHTML = `
            <div class="review-actions mt-2">
              <button class="btn btn-sm btn-outline-primary edit-review-btn me-2" data-id="${reviewData.id}">
                Edit
              </button>
              <button class="btn btn-sm btn-danger delete-review-btn" data-id="${reviewData.id}">
                Hapus${adminBadge}
              </button>
            </div>`;
        }

        const displayName = reviewData.userName || reviewData.name || 'Anonymous';
        const reviewText = reviewData.text || reviewData.content || '';

        // NEW: Add special styling for loved reviews
        const cardClass = loveCount > 0 ? 'card-review p-3 border rounded bg-light border-danger' : 'card-review p-3 border rounded bg-light';
        const headerClass = loveCount > 0 ? 'review-header d-flex justify-content-between border-bottom border-danger pb-2' : 'review-header d-flex justify-content-between';

        div.innerHTML = `
          <div class="${cardClass}">
            ${loveCount > 0 ? '<div class="loved-indicator text-danger text-center mb-2"><small>❤️ Admin Favorite ❤️</small></div>' : ''}
            <div class="${headerClass}">
              <span class="review-name fw-bold">${displayName}</span>
              <span class="review-date text-muted">${displayDate}${editedIndicator}</span>
            </div>
            ${adminLoveHTML}
            <div class="review-text mt-2" id="review-text-${reviewData.id}">${reviewText}</div>
            <div class="review-edit-form mt-2" id="edit-form-${reviewData.id}" style="display: none;">
              <textarea class="form-control mb-2" id="edit-text-${reviewData.id}" rows="3">${reviewText}</textarea>
              <button class="btn btn-sm btn-success save-edit-btn me-2" data-id="${reviewData.id}">Simpan</button>
              <button class="btn btn-sm btn-secondary cancel-edit-btn" data-id="${reviewData.id}">Batal</button>
            </div>
            ${actionButtonsHTML}
          </div>
        `;

        reviewList.appendChild(div);
        console.log("Added review to DOM:", displayName);
      });

      // NEW: Event handlers for admin love buttons
      document.querySelectorAll('.admin-love-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const reviewId = this.getAttribute('data-review-id');
          toggleReviewLove(reviewId, bookId);
        });
      });

      // Event handlers for edit buttons
      document.querySelectorAll('.edit-review-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const reviewId = this.getAttribute('data-id');
          showEditForm(reviewId);
        });
      });

      // Event handlers for save edit buttons
      document.querySelectorAll('.save-edit-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          const reviewId = this.getAttribute('data-id');
          await saveEditedReview(reviewId, bookId);
        });
      });

      // Event handlers for cancel edit buttons
      document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const reviewId = this.getAttribute('data-id');
          cancelEdit(reviewId);
        });
      });

      // Event handler for delete buttons
      document.querySelectorAll('.delete-review-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          const reviewId = this.getAttribute('data-id');
          
          let confirmMessage = "Yakin ingin menghapus review ini?";
          if (currentUserRole === 'admin') {
            confirmMessage = "🛡️ Admin: Yakin ingin menghapus review ini?\n\n(Anda dapat menghapus review siapa saja sebagai admin)";
          }
          
          if (confirm(confirmMessage)) {
            await deleteReview(reviewId, bookId);
          }
        });
      });
    }
  } catch (error) {
    console.error("Error getting reviews: ", error);
    console.error("Error details:", error.message, error.code);
    
    reviewList.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error:</strong> Gagal memuat reviews. ${error.message}
        <br><small>Silakan refresh halaman atau hubungi admin.</small>
      </div>
    `;
  }
}

// Show edit form for a review
function showEditForm(reviewId) {
  const reviewText = document.getElementById(`review-text-${reviewId}`);
  const editForm = document.getElementById(`edit-form-${reviewId}`);
  
  if (reviewText && editForm) {
    reviewText.style.display = 'none';
    editForm.style.display = 'block';
    
    const textarea = document.getElementById(`edit-text-${reviewId}`);
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }
}

// Cancel edit and hide form
function cancelEdit(reviewId) {
  const reviewText = document.getElementById(`review-text-${reviewId}`);
  const editForm = document.getElementById(`edit-form-${reviewId}`);
  
  if (reviewText && editForm) {
    reviewText.style.display = 'block';
    editForm.style.display = 'none';
  }
}

// Save edited review
async function saveEditedReview(reviewId, bookId) {
  const textarea = document.getElementById(`edit-text-${reviewId}`);
  
  if (!textarea) {
    console.error("Textarea not found for review:", reviewId);
    return;
  }
  
  const newText = textarea.value.trim();
  
  if (!newText) {
    alert("Review tidak boleh kosong.");
    return;
  }
  
  try {
    console.log("Updating review:", reviewId);
    
    await updateDoc(doc(window.db, "reviews", reviewId), {
      text: newText,
      content: newText,
      updatedAt: serverTimestamp()
    });
    
    console.log("Review updated successfully");
    
    cancelEdit(reviewId);
    
    const reviewTextElement = document.getElementById(`review-text-${reviewId}`);
    if (reviewTextElement) {
      reviewTextElement.textContent = newText;
    }
    
    setTimeout(() => {
      renderReviews(bookId);
    }, 1000);
    
    showTemporaryMessage("Review berhasil diperbarui!", "success");
    
  } catch (error) {
    console.error("Error updating review:", error);
    alert("Gagal memperbarui review: " + error.message);
  }
}

// Delete review function
async function deleteReview(reviewId, bookId) {
  try {
    if (currentUserRole === 'admin') {
      console.log(`Admin ${currentUserId} deleting review ${reviewId}`);
    }
    
    await deleteDoc(doc(window.db, "reviews", reviewId));
    console.log("Review deleted successfully");
    renderReviews(bookId);
    
    if (currentUserRole === 'admin') {
      showTemporaryMessage("Review berhasil dihapus (Admin Action)", "success");
    } else {
      showTemporaryMessage("Review berhasil dihapus", "success");
    }
  } catch (error) {
    console.error("Error deleting review:", error);
    alert("Gagal menghapus review. Silakan coba lagi.");
  }
}

// Check if user already reviewed this book
async function checkExistingReview(userId, bookId) {
  try {
    console.log("Checking existing review for userId:", userId, "bookId:", bookId);
    
    if (!window.db) {
      console.error("Firebase db not available");
      return false;
    }
    
    const bookIdVariants = [
      bookId,
      `/works/${bookId}`,
      bookId.replace('/works/', '')
    ];
    
    for (const variant of bookIdVariants) {
      const q = query(
        collection(window.db, "reviews"),
        where("userId", "==", userId),
        where("bookId", "==", variant)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        console.log(`Existing review found with bookId: ${variant}`);
        return true;
      }
    }
    
    console.log("No existing review found for any bookId variant");
    return false;
  } catch (error) {
    console.error("Error checking existing review:", error);
    console.error("Error details:", error.message, error.code);
    return false;
  }
}

// Event listeners for form submission and toggle
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

      console.log("Form submitted!");
      console.log("Current user:");
      console.log("Firebase db:", window.db);

      if (currentUsername === "Guest" || !currentUserId) {
        console.log("User not logged in, showing modal");
        const modal = new bootstrap.Modal(document.getElementById('loginModal'));
        modal.show();
        return;
      }

      const text = reviewText.value.trim();
      if (!text) {
        alert("Mohon isi review Anda.");
        return;
      }

      const bookId = reviewForm.getAttribute('book-id');
      console.log("Book ID:", bookId);
      
      if (!bookId) {
        console.error("bookId is empty!");
        alert("Book ID tidak ditemukan!");
        return;
      }

      // Check Firebase connection
      if (!window.db) {
        console.error("Firebase database not initialized!");
        alert("Koneksi database bermasalah!");
        return;
      }

      try {
        console.log("Checking for existing reviews...");
        // Check if user already reviewed this book
        const hasReviewed = await checkExistingReview(currentUserId, bookId);
        console.log("Has reviewed:", hasReviewed);
        
        if (hasReviewed) {
          alert("Anda sudah memberikan review untuk buku ini.");
          return;
        }

        console.log("Adding new review...");
        
        // FIXED: Create review with structure compatible with Flutter app
        // Need to handle different bookId formats between app and web
        const reviewData = {
          bookId: bookId,           // Keep original format from web
          userId: currentUserId,    // Same as Flutter  
          userName: currentUsername, // Same as Flutter
          text: text,               // Primary text field
          content: text,            // Also add content for compatibility
          createdAt: serverTimestamp(), // Same as Flutter
          updatedAt: serverTimestamp()  // Same as Flutter
        };

        console.log("Review data to be added:", reviewData);

        const docRef = await addDoc(collection(window.db, "reviews"), reviewData);
        console.log("Document written with ID: ", docRef.id);

        reviewText.value = '';
        reviewFormContainer.style.display = 'none';
        
        // Wait a bit before refreshing to allow Firestore to sync
        setTimeout(() => {
          renderReviews(bookId);
        }, 1000);
        
        alert("Review berhasil ditambahkan!");
        
      } catch (error) {
        console.error("Error adding review: ", error);
        console.error("Error details:", error.message, error.code);
        alert("Gagal menambahkan review: " + error.message);
      }
    });
  }
});

// Additional utility functions for compatibility

// Get review count for a book (FIXED - handle different bookId formats)
export async function getReviewCount(bookId) {
  try {
    const bookIdVariants = [
      bookId,
      `/works/${bookId}`,
      bookId.replace('/works/', '')
    ];
    
    let totalCount = 0;
    const foundIds = new Set(); // Avoid counting duplicates
    
    for (const variant of bookIdVariants) {
      const q = query(collection(window.db, "reviews"), where("bookId", "==", variant));
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((doc) => {
        if (!foundIds.has(doc.id)) {
          foundIds.add(doc.id);
          totalCount++;
        }
      });
    }
    
    return totalCount;
  } catch (error) {
    console.error("Error getting review count:", error);
    return 0;
  }
}

// Get user's reviews (FIXED - compatible with Flutter structure)
export async function getUserReviews(userId) {
  try {
    const q = query(
      collection(window.db, "reviews"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    
    const reviews = [];
    querySnapshot.forEach((doc) => {
      reviews.push({ id: doc.id, ...doc.data() });
    });
    
    return reviews;
  } catch (error) {
    console.error("Error getting user reviews:", error);
    // Fallback without orderBy if index missing
    try {
      const simpleQuery = query(
        collection(window.db, "reviews"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(simpleQuery);
      
      const reviews = [];
      querySnapshot.forEach((doc) => {
        reviews.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort manually
      reviews.sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
        const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
        return dateB - dateA;
      });
      
      return reviews;
    } catch (fallbackError) {
      console.error("Fallback getUserReviews also failed:", fallbackError);
      return [];
    }
  }
}

// NEW: Export the deleteAllReviews function for external use if needed
export { deleteAllReviews };