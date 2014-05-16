/**
 * Live preview for forms.
 *
 * @todo Docs.
 * @todo Add issue summary textarea.
 * @todo Add minimally mocked filter_autop + url + issue-link implementation.
 */
Drupal.behaviors.dreditorFormPreview = {
  attach: function (context) {
    var $context = $(context);
    $context.find('.text-format-wrapper:has(textarea[name*="comment"])')
      .once('dreditor-form-preview', function () {
        new Drupal.dreditor.formPreview(
          this,
          $context.find('div.comment').width(),
          '<div class="comment"><div class="content">^</div></div>'
        );
      });
  }
};

Drupal.dreditor.formPreview = function (widget, width, template) {
  var self = this;
  this.$widget = $(widget);
  this.width = width;
  this.template = template;
  this.$form = this.$widget.find('.form-textarea-wrapper');

  this.$button = $('<button type="button" class="dreditor-button">Live preview</button>');
  this.$button.bind('click.preview', { self: self }, this.preview);

  this.$widget.find('.filter-wrapper > .fieldset-wrapper > *:eq(1)')
    .append(this.$button);
};

Drupal.dreditor.formPreview.prototype = {
  $widget: null,
  $form: null,
  $button: null,
  duration: 300,
  width: null,
  template: null,
  $preview: null,

  preview: function (e) {
    var self = e.data.self;
    self.$preview = $('<div class="dreditor-form-preview"></div>')
      .hide()
      .css('width', self.width + 'px')
      .html(self.template.replace('^', self.$form.find('textarea').val()))
      .insertAfter(self.$form);
    self.$form.slideUp(self.duration);
    self.$preview.slideDown(self.duration);
    self.$button.unbind('click.preview').bind('click.preview', { self: self }, self.restoreForm);
  },

  restoreForm: function (e) {
    var self = e.data.self;
    self.$form.slideDown(self.duration);
    self.$preview.slideUp(self.duration, function () {
      self.$preview.remove();
      delete self.$preview;
    });
    self.$button.unbind('click.preview').bind('click.preview', { self: self }, self.preview);
  }
};

