'use strict';

// Gulp plugins
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var browserSync = require('browser-sync').create();
var postcss = require('gulp-postcss');
var assets = require('postcss-assets');
var cssnano = require('cssnano');
var del = require('del');
var fs = require('fs');
var pug = require('pug');
var purgecss = require('gulp-purgecss');

// Filter block: Allow add filter
pug.filters.code = function (block) {
  return block
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

var baseDirs = {
  source: 'source/',
  dest: 'dest/',
  sourceSCSS: 'source/sass/**/',
  sourceJS: 'source/js/',
  sourceJSON: 'source/modules/**/data/',
};

var options = {
  del: [baseDirs.dest],
  browserSync: {
    server: {
      baseDir: baseDirs.dest,
      index: 'links.html',
    },
    ghostMode: false,
  },
  htmlPrettify: {
    indent_size: 2,
    unformatted: ['pre', 'code'],
    indent_with_tabs: false,
    preserve_newlines: true,
    brace_style: 'expand',
    end_with_newline: true,
  },
  include: {
    hardFail: true,
    includePaths: [
      __dirname + '/',
      __dirname + '/node_modules',
      __dirname + '/source/js',
    ],
    separateInputs: true,
  },
  pug: {
    pug: pug,
    pretty: '\t',
  },
  scss: {
    outputStyle: 'compact',
    precison: 3,
    errLogToConsole: true,
    includePaths: ['./node_modules'],
    in: [baseDirs.sourceSCSS + '*.scss'],
    out: baseDirs.dest + 'css/',
  },
  js: {
    in: [baseDirs.sourceJS + '*.js'],
    out: baseDirs.dest + 'js/',
  },
  fonts: {
    in: [baseDirs.source + 'fonts/**/*.*'],
    out: baseDirs.dest + 'fonts/',
  },
  images: {
    in: [baseDirs.source + 'images/**/*.*'],
    out: baseDirs.dest + 'images/',
  },
};

// ======================================================
// Init browser-sync
// ======================================================
gulp.task('browser-sync', function () {
  return browserSync.init(options.browserSync);
});

gulp.task('setWatch', function () {
  global.isWatching = true;
});

// ======================================================
// Watch
// ======================================================
gulp.task('watch', function (cb) {
  $.watch(baseDirs.source + '/images/**/*.*', function () {
    gulp.series('copy:images')(browserSync.reload);
  });

  $.watch(
    [baseDirs.source + '/*.html', baseDirs.source + '/**/*.html'],
    function () {
      gulp.series('compile-html')(browserSync.reload);
    }
  );

  $.watch(
    [baseDirs.source + '/*.pug', baseDirs.source + '/**/*.pug'],
    function () {
      gulp.series('compile-pug')(browserSync.reload);
    }
  );

  $.watch(baseDirs.source + '/modules/*/data/*.json', function () {
    gulp.series('compile:markup')(browserSync.reload);
  });

  $.watch(options.scss.in, function () {
    gulp.series('compile:style')(browserSync.stream());
  });

  $.watch(options.js.in, function () {
    gulp.series('compile:script')(browserSync.reload);
  });

  $.watch('source/images/svg/*.svg', function () {
    gulp.series('create-svg-icon')(browserSync.reload);
  });
});

// ======================================================
// Copy
// ======================================================
// Copy Favicon
gulp.task('copy:favicon', function () {
  return gulp.src('./favicon.ico').pipe(gulp.dest(baseDirs.dest));
});

// Copy Fonts
gulp.task('copy:fonts', function () {
  return gulp.src(options.fonts.in).pipe(gulp.dest(options.fonts.out));
});

// Copy Image
gulp.task('copy:images', function () {
  return gulp
    .src(['images/**/*.*', '!images/svg/*.*'], { cwd: baseDirs.source })
    .pipe(gulp.dest(options.images.out));
});

// ======================================================
// Delete
// ======================================================
gulp.task('cleanup', function (cb) {
  return del(options.del, cb);
});

// ======================================================
// Compile markup
// ======================================================
// Combine data
gulp.task('combine-modules-json', function () {
  return gulp
    .src(['**/*.json', '!**/_*.json'], { cwd: baseDirs.sourceJSON })
    .pipe($.mergeJson({ fileName: 'data-json.json' }))
    .pipe(gulp.dest('tmp/data'));
});

gulp.task('combine-modules-data', function () {
  return gulp
    .src('**/*.json', { cwd: 'tmp/data' })
    .pipe($.mergeJson({ fileName: 'data.json' }))
    .pipe(gulp.dest('tmp'));
});

gulp.task('combine-data', function (cb) {
  gulp.series('combine-modules-json', 'combine-modules-data')(cb);
});

// Compile Pug
gulp.task('compile-pug', function (cb) {
  var jsonData = JSON.parse(fs.readFileSync('./tmp/data.json'));
  options.pug.locals = jsonData;

  return (
    gulp
      .src(['*.pug', '!_*.pug'], { cwd: baseDirs.source })
      .pipe(
        $.plumber(function (error) {
          console.log('Task compile-pug has error', error.message);
          this.emit('end');
        })
      )
      .pipe($.changed('dest', { extension: '.html' }))

      // FIXME: Not work well, I will comment out temporary
      // .pipe($.if(global.isWatching, $.cached('compile-pug')))

      .pipe(
        $.pugInheritance({
          basedir: baseDirs.source,
          skip: ['node_modules'],
        })
      )
      .pipe($.pug(options.pug))
      .on('error', function (error) {
        console.error('' + error);
        this.emit('end');
      })
      .pipe($.prettify(options.htmlPrettify))
      .pipe($.plumber.stop())
      .pipe(gulp.dest(baseDirs.dest))
  );
});

// Compile HTML
gulp.task('compile-html', function (cb) {
  return gulp
    .src(['*.html', '!_*.html'], { cwd: baseDirs.source })
    .pipe($.prettify(options.htmlPrettify))
    .pipe(gulp.dest(baseDirs.dest));
});

gulp.task('compile:markup', function (cb) {
  gulp.series('combine-data', 'compile-pug', 'compile-html')(cb);
});

// ======================================================
// Build style
// ======================================================
gulp.task('stylelint', function (cb) {
  return (
    gulp
      .src(options.scss.in)

      // FIXME: Not work well, I will comment out temporary
      // .pipe($.if(global.isWatching, $.cached('stylelint')))

      .pipe(
        $.stylelint({
          reporters: [
            {
              formatter: 'string',
              console: true,
            },
          ],
        })
      )
  );
});

gulp.task(
  'compile:style',
  gulp.series('stylelint', function stylelintChecking(cb) {
    return gulp
      .src(options.scss.in)
      .pipe($.sourcemaps.init())
      .pipe($.sass(options.scss).on('error', $.sass.logError))
      .pipe($.autoprefixer('last 2 versions'))
      .pipe(
        postcss([
          assets({
            basePath: 'source/',
            loadPaths: ['images/'],
          }),
        ])
      )
      .pipe(
        $.if(
          process.argv[3] == '--minify',
          postcss([
            cssnano({
              preset: [
                'default',
                {
                  discardComments: {
                    removeAll: true,
                  },
                },
              ],
            }),
          ])
        )
      )
      .pipe(
        $.sourcemaps.write('./', {
          includeContent: false,
          sourceRoot: baseDirs.sourceSCSS,
        })
      )
      .pipe(gulp.dest(options.scss.out))
      .pipe(browserSync.stream());
  })
);

// ======================================================
// Compile script
// ======================================================
gulp.task('eslint', function (cb) {
  return gulp
    .src(options.js.in)
    .pipe($.eslint({ configFile: '.eslintrc.json' }))
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError());
});

gulp.task(
  'compile:script',
  gulp.series('eslint', function eslintChecking() {
    return gulp
      .src(['*.js', '!_*.js'], { cwd: baseDirs.sourceJS })
      .pipe(
        $.plumber(function (error) {
          console.log('Task compile-js has error', error.message);
          this.emit('end');
        })
      )
      .pipe($.include(options.include))
      .pipe($.plumber.stop())
      .pipe(gulp.dest(options.js.out));
  })
);

// ======================================================
// Create SVG Icon
// ======================================================
const svgConfig = {
  mode: {
    symbol: {
      dest: '.',
      sprite: 'sprite.svg',
    },
  },
};

gulp.task('create-svg-icon', function () {
  return gulp
    .src('source/images/svg/*.svg')
    .pipe(
      $.cheerio({
        run: function ($) {
          $('[fill]').removeAttr('fill');
        },
        parserOptions: { xmlMode: true },
      })
    )
    .pipe($.svgSprite(svgConfig))
    .pipe(gulp.dest(options.images.out));
});

gulp.task('svg-minify', function () {
  return gulp
    .src('source/images/*.svg')
    .pipe($.svgmin())
    .pipe(gulp.dest(options.images.out));
});

gulp.task('purgecss', () => {
  return gulp
    .src(['dest/css/*.css', '!dest/css/customize-root.css'])
    .pipe(
      purgecss({
        content: ['dest/*.html', 'dest/js/*.js'],
      })
    )
    .pipe(gulp.dest('dest/css'));
});

// ======================================================
// MAIN TASK: Development
// ======================================================
gulp.task('dev', function (cb) {
  gulp.series(
    'cleanup',
    'copy:favicon',
    'copy:fonts',
    'copy:images',
    'compile:markup',
    'compile:style',
    'compile:script',
    'create-svg-icon',
    'svg-minify',
    gulp.parallel('browser-sync', 'watch')
  )(cb);
});

// ======================================================
// MAIN TASK: Production
// ======================================================
gulp.task('build', function (cb) {
  gulp.series(
    'cleanup',
    'copy:favicon',
    'copy:fonts',
    'copy:images',
    'compile:markup',
    'compile:style',
    'compile:script',
    'create-svg-icon',
    'svg-minify',
    'purgecss'
  )(cb);
});
