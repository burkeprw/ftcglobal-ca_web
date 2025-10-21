document.querySelectorAll('.button').forEach(button => {

  if (button.hasAttribute('data-story-id')) {

    button.addEventListener('click', function(event) {
      event.preventDefault();

      const storyId = this.getAttribute('data-story-id');
      const storyHTML = document.getElementById(storyId).innerHTML;

      document.querySelector('#storyModal .modal-body').innerHTML = storyHTML;
      document.getElementById('storyModal').style.display = 'block';
    });
  }
});

document.querySelector('.close-button').addEventListener('click', () => {
  document.getElementById('storyModal').style.display = 'none';
});

window.addEventListener('click', (event) => {
  const modal = document.getElementById('storyModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});