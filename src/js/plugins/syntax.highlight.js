/**
 * CODE syntax highlighting.
 */
Drupal.behaviors.dreditorSyntaxHighlight = {
  attach: function (context) {
    var self = this;
    var $context = $(context);
    $context.find('.diff > .codeblock > code').once('syntaxhighlight', self.highlightDiff);
  },

  highlightDiff: function () {
    var line;
    $(this).contents().each(function () {
      if (this.nodeType !== Node.TEXT_NODE) {
        return;
      }
      line = this.textContent;
      if (line[0] === '+' && line[1] === '+' ||
          line[0] === '-' && line[1] === '-' ||
          line[0] === '@') {
        $(this).wrap('<span class="file"></span>');
      }
      else if (line[0] === '-') {
        $(this).wrap('<span class="old"></span>');
      }
      else if (line[0] === '+') {
        $(this).wrap('<span class="new"></span>');
      }
    });
  }
};
