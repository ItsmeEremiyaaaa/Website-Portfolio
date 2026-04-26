gsap.registerPlugin(ScrollTrigger);

// Pin the intro text section
ScrollTrigger.create({
  trigger: ".intro-wrapper",
  start: "top top",
  end: "bottom top",
  pin: ".text-align-center",
  pinSpacing: false
});

// Handling the scroll for the tabs and videos
document.addEventListener("scroll", () => {
  const scrollPosition = window.scrollY;
  const windowHeight = window.innerHeight + 550;
  const sections = document.querySelectorAll('.tabs_let-content');
  const videos = document.querySelectorAll('.tabs_video');
  const lastIndex = sections.length - 1;

  sections.forEach((section, index) => {
    const inRange = scrollPosition >= (index * windowHeight) && scrollPosition < ((index + 1) * windowHeight);

    if (inRange) {
      section.classList.add('is-1');
      videos[index]?.classList.add('is-1');
    } else {
      if (index !== lastIndex) {
        section.classList.remove('is-1');
        videos[index]?.classList.remove('is-1');
      }
    }
  });

  if (scrollPosition > (lastIndex * windowHeight)) {
    sections[lastIndex].classList.add('is-1');
    videos[lastIndex]?.classList.add('is-1');
  } else {
    sections[lastIndex].classList.remove('is-1');
    videos[lastIndex]?.classList.remove('is-1');
  }
});
