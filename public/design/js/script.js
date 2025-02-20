

  /**
   * Animation on scroll function and init
   */
  function aosInit() {
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }
  window.addEventListener('load', aosInit);




  // Function to initialize the Owl Carousel
  function initializeCarousel() {
      const owl = document.querySelector('.owl-carousel');

      // Initialize the carousel with custom options
      $(owl).owlCarousel({
          items: 1,
          loop: true,
          autoplay: true,
          autoplayTimeout: 5000, // Auto-scroll after 4 seconds
          autoplayHoverPause: true, // Pause on hover
          dots: false, // Enable dots for navigation
          nav: false // Disable default navigation buttons
      });
  }


  // Initialize everything on window load
  window.addEventListener('load', function() {
      initializeCarousel();
  });







// Slide-in, slide-out, and auto-remove logic
document.querySelectorAll('.message').forEach((message, index) => {
  // Add slide-in effect
  setTimeout(() => {
      message.classList.add('show'); // Add 'show' class for animation

      // Auto-remove after 3 seconds
      setTimeout(() => {
          message.classList.add('remove'); // Slide out
          setTimeout(() => {
              message.style.display = 'none'; // Hide the element
          }, 500); // Match remove animation duration
      }, 3000);
  }, index * 1000); // Stagger animations

  // Close button functionality
  const closeButton = message.querySelector('.close-btn');
  if (closeButton) {
      closeButton.addEventListener('click', () => {
          message.classList.add('remove'); // Slide out immediately
          setTimeout(() => {
              message.style.display = 'none'; // Hide element
          }, 500); // Match remove animation duration
      });
  }
});
