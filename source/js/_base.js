$(document).ready(function () {
  // Slider
  $('.main-slide').slick({
    slidesToShow: 1,
    slidesToScroll: 1,
    infinite: true,
    dots: true,
    prevArrow: "<span class='material-icons-outlined prev'>chevron_left</span>",
    nextArrow:
      "<span class='material-icons-outlined next'>chevron_right</span>",
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          arrows: false,
        },
      },
    ],
  });

  // Set direction card
  var width = $(window).width();

  if (width > 992) {
    $('.js-card:nth-child(4n)').addClass('last');
  }
  if (width < 992 && width >= 768) {
    $('.js-card:nth-child(3n)').addClass('last');
  }
  if (width < 768) {
    $('.js-card:nth-child(2n)').addClass('last');
  }

  // Select language
  $('.dropdown-menu').on('click', '.dropdown-item', function (e) {
    e.preventDefault();
    var getLanguage = $(this).find('.dropdown-item__inner').clone();
    $('.js-language').find('.language-inner').html(getLanguage);
    $('.js-language').find('.dropdown-item').removeClass('choose');
    $(this).addClass('choose');
  });
});
