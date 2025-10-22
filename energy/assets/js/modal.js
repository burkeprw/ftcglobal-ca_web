// Function to open modal by story ID
function openStoryModal(storyId) {
  const storyElement = document.getElementById(storyId);
  if (storyElement) {
    const storyHTML = storyElement.innerHTML;
    document.querySelector('#storyModal .modal-body').innerHTML = storyHTML;
    document.getElementById('storyModal').style.display = 'block';
  }
}

// Select all clickable elements with data-story-id (buttons, images, titles)
document.querySelectorAll('[data-story-id]').forEach(element => {
  element.addEventListener('click', function(event) {
    event.preventDefault();
    const storyId = this.getAttribute('data-story-id');
    openStoryModal(storyId);
  });
});

// Close modal with “X” button
document.querySelector('.close-button').addEventListener('click', () => {
  document.getElementById('storyModal').style.display = 'none';
});

// Close modal when clicking outside it
window.addEventListener('click', (event) => {
  const modal = document.getElementById('storyModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});