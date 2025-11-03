// Function to open a modal with content from a hidden div
function openModal(popupId) {
  const modal = document.getElementById('popupModal');
  const modalBody = modal.querySelector('.modal-body');
  const Content = document.getElementById(popupId);

  if (Content) {
    modalBody.innerHTML = Content.innerHTML;
    modal.style.display = 'block';
  } else {
    console.warn('No element found for popup ID:', popupId);
  }
}

// Add event listeners for all elements with data-story-id
document.querySelectorAll('[popup]').forEach(element => {
  element.addEventListener('click', event => {
    event.preventDefault();
    const popupId = element.getAttribute('popup');
    openModal(popupId);
  });
});

// Close button handler
document.querySelector('.close-button').addEventListener('click', () => {
  document.getElementById('popupModal').style.display = 'none';
});

// Close modal if background clicked
window.addEventListener('click', event => {
  const modal = document.getElementById('popupModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});