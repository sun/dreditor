// ==UserScript==
// @name           Dreditor: Patch review
// @namespace      http://drupal.org/project/dreditor
// @description    Highlights and outlines diff syntax in patch files.
// @author         Daniel F. Kudwien (sun)
// @version        0.1
// @include        http://drupal.org/node/*
// ==/UserScript==

// Initialize window objects.
$ = window.$ = window.jQuery = unsafeWindow.jQuery;
Drupal = window.Drupal = unsafeWindow.Drupal;

Drupal.dreditor = Drupal.dreditor || { behaviors: {} };

Drupal.dreditor.setup = function (context) {
  // Setup Dreditor overlay.
  $('<div id="dreditor-overlay"></div>').css({ opacity: 0 }).appendTo('body').animate({ opacity: 0.7 });
  var $file = $('<div id="dreditor-wrapper"></div>').hide();
  // Add Dreditor content area.
  $file.append('<div id="dreditor"></div>').appendTo('body');

  // Add sidebar, containing ul#menu by default for convenience.
  var $bar = $('<div id="bar"></div>').append('<ul id="menu"></ul>').appendTo('#dreditor');
  // Add cancel button to tear down Dreditor.
  $('<input id="dreditor-cancel" class="dreditor-button" type="button" value="Cancel" />').click(function () {
    return Drupal.dreditor.tearDown(context);
  }).appendTo($bar);
};

Drupal.dreditor.tearDown = function (context) {
  $('#dreditor-overlay, #dreditor-wrapper', context).animate({ height: 0 }, function () {
    $(this).remove();
    // Drupal.dreditor.setup(context);
  });
  return false;
};

/**
 * Attach patch review editor to issue attachments.
 */
Drupal.behaviors.dreditorPatchReview = function (context) {
  $('#attachments:not(.dreditor-patchreview-processed), #comments table.comment-upload-attachments:not(.dreditor-patchreview-processed)', context)
    .addClass('dreditor-patchreview-processed')
    .find('a').each(function () {
      if (this.href.indexOf('.patch') == -1) {
        return;
      }
      // Generate review link.
      var $link = $('<a id="dreditor-patchreview" class="dreditor-button" href="' + this.href + '">review</a>').click(function () {
        // Load file.
        $.get(this.href, function (content, status) {
          if (status == 'success') {
            // Show overlay.
            Drupal.dreditor.setup(context);
            $('#dreditor-wrapper', context).animate({ height: '100%' }).show();
            // Apply Dreditor(.patchReview).behaviors.
            $.each(Drupal.dreditor.behaviors, function () {
              this(context, content);
            });
            // Apply Drupal behaviors.
            Drupal.attachBehaviors(context);
          }
        });
        return false;
      });
      // Append review link to parent table cell.
      $link.appendTo(this.parentNode);
    });
};

/**
 * Create diff outline and highlighting from plaintext code.
 *
 * We parse all lines of the file into separate DOM elements to be able to
 * attach data (e.g. comments) to selected lines and generate a "jump menu"
 * for files and hunks.
 *
 * @param context
 *   The context to work on.
 * @param code
 *   Plain-text code to parse.
 *
 * @todo Move setup and storage of outline menu and pastie outside.
 * @todo Rework namespace: dreditor, behaviors, patchReview.
 */
Drupal.dreditor.behaviors.diffView = function (context, code) {
  var $dreditor = $('#dreditor', context);
  var file_context = $dreditor.get(0);
  // Initialize review comments.
  Drupal.dreditor.comments = [];

  // Convert CRLF, CR into LF.
  code = code.replace(/\r\n|\r/g, "\n");
  // Escape all HTML.
  code = code.replace(/</g, '&lt;');
  code = code.replace(/>/g, '&gt;');
  // Remove cruft: IDE comments and unversioned files.
  code = code.replace(/^\# .+\n|^\? .+\n/mg, '');

  // Setup code container.
  var $code = $('<div id="code"></div>');
  var $menu = $('#menu', context);
  var $lastFile;

  code = code.split('\n');
  for (var n in code) {
    var line = code[n];
    // Build file menu.
    line = line.replace(/^(\+\+\+ )([^\s]+)(\s.*)/, function (full, match1, match2, match3) {
      $lastFile = $('<li><a href="#' + match2 + '">' + match2 + '</a></li>');
      $menu.append($lastFile);
      return match1 + '<a id="' + match2 + '">' + match2 + '</a>' + match3;
    });
    // Build hunk menu.
    line = line.replace(/^(@@ .+ @@\s+)([^\s]+\s[^\s\(]*)/, function (full, match1, match2) {
      $lastFile.append('<li><a href="#' + match2 + '">' + match2 + '</a></li>');
      return match1 + '<a id="' + match2 + '">' + match2 + '</a>';
    });

    // Colorize file diff lines.
    if (line.match(/^((Index|===|RCS|retrieving|diff|\-\-\- |\+\+\+ |@@ ).*)$/i)) {
      line = '<pre class="file">' + line + '</pre>';
    }
    // Colorize old code, but skip file diff lines.
    else if (line.match(/^((?!\-\-\-)\-.*)$/)) {
      line = '<pre class="old">' + line + '<span /></pre>';
    }
    // Colorize new code, but skip file diff lines.
    else if (line.match(/^((?!\+\+\+)\+.*)$/)) {
      line = '<pre class="new">' + line + '<span /></pre>';
    }
    // Wrap all other lines in PREs for copy/pasting.
    else {
      line = '<pre>' + line + '<span /></pre>';
    }

    // Append code line to body.
    $code.append(line);
  }
  // Append code to body.
  $code.appendTo($dreditor);

  // Add Pastie.
  var $pastie = $('<div id="pastie"></div>').hide();
  $pastie.append('<textarea class="resizable"></textarea>');
  $('<input id="dreditor-submit" class="dreditor-button" type="button" value="Add" />')
    .click(function () {
      var $textarea = $(this).parent().find('textarea');
      // If a comment was entered,
      if ($.trim($textarea.val())) {
        var $lines = $pastie.data('dreditor.lines');
        // ...store it in a global stack
        Drupal.dreditor.comments.push({
          elements: $lines,
          comment: $textarea.val()
        });
        var newid = Drupal.dreditor.comments.length - 1;
        // ...and attach it to the selected code.
        $lines.data('dreditor.comment', newid).addClass('has-comment').click(function () {
          var id = $(this).data('dreditor.comment');
          alert(Drupal.dreditor.comments[id].comment);
          return false;
        });
      }
    })
    .appendTo($pastie);
  $pastie.appendTo('#bar');

  // Copy any selection.
  $code.mouseup(function () {
    var range = window.getSelection().getRangeAt(0);
    if (!range.toString()) {
      return;
    }

    // Grep selected lines.
    var $lines = $([]);
    var next = range.startContainer.parentNode;
    while (next != range.endContainer.parentNode) {
      $lines = $lines.add(next);
      next = next.nextSibling;
    }
    $lines = $lines.add(range.endContainer.parentNode);

    // Trigger pastie.
    $pastie.data('dreditor.lines', $lines)
      .show();
  });
};

jQuery(document).ready(function () {
  // @todo Behaviors of this user script are not invoked with regular behaviors.
  Drupal.attachBehaviors(this);
});

// Add custom stylesheet.
GM_addStyle(" \
#dreditor-overlay { position: fixed; z-index: 999; width: 100%; height: 100%; top: 0; background-color: #fff; } \
#dreditor-wrapper { position: fixed; z-index: 1000; width: 100%; top: 0; } \
#dreditor { position: relative; width: 95%; height: 90%; margin: auto auto; background-color: #fff; border: 1px solid #ccc; } \
#dreditor #bar { position: absolute; width: 230px; height: 100%; padding: 0 10px; font: 10px/18px sans-serif, verdana, tahoma, arial; } \
.dreditor-button, #content a.dreditor-button { background: transparent url(/sites/all/themes/bluebeach/header-back.png) repeat-x 0 -30px; border: 1px solid #06c; color: #fff; cursor: pointer; font: 11px sans-serif, verdana, tahoma, arial; font-weight: bold; padding: 1px 9px; text-transform: uppercase; text-decoration: none; -moz-border-radius: 9px; -webkit-border-radius: 9px; border-radius: 9px; } \
.dreditor-button:hover, #content a.dreditor-button:hover { background-position: 0 0; } \
.dreditor-patchreview-processed .dreditor-button { margin-left: 1em; } \
#dreditor-cancel { position: absolute; bottom: 8px; } \
#dreditor #menu { margin: 0; padding: 0; } \
#dreditor #menu li { margin: 0; padding: 0 10px 0; list-style: none; } \
#dreditor a { text-decoration: none; } \
#dreditor #pastie { width: 100%; height: 12em; font: 13px 'courier new', courier, 'lucida console'; color: #000; } \
#dreditor #code { margin-left: 250px; border-left: 1px solid #ccc; padding-left: 10px; overflow: scroll; height: 100%; } \
#dreditor #code pre { margin: 0; font: 13px 'courier new', courier, 'lucida console'; background-color: transparent; border: 0; padding: 0; } \
#dreditor #code pre span { display: inline-block; margin-left: 2px; width: 2px; height: 7px; background-color: #ddd; } \
#dreditor #code .file { color: #088; } \
#dreditor #code .new { color: #00d; } \
#dreditor #code .old { color: #d00; } \
#dreditor #code .has-comment { background-color: #eee; } \
");