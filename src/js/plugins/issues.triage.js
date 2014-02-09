Drupal.behaviors.dreditorIssuesTriage = {
  attach: function (context) {
    if (window.location.pathname.indexOf('project/issues') === -1) {
      return;
    }
    // Add link to toggle this feature.
    $('table.project-issue', context).once('dreditor-triage-toggle', function () {
      var enabled = Drupal.storage.load('issuetriage.status');
      $('<a href="#" class="dreditor-application-toggle"></a>')
        .text(enabled ? 'Disable Triage mode' : 'Enable Triage mode')
        .click(function () {
          // Reverse the status value to make this handler more logical.
          enabled = !enabled;
          this.textContent = (enabled ? 'Disable Triage mode' : 'Enable Triage mode');
          if (enabled) {
            Drupal.dreditor.triageMode.setup(context);
          }
          else {
            Drupal.dreditor.triageMode.teardown(context);
          }
          Drupal.storage.save('issuetriage.status', enabled);
          return false;
        })
        .prependTo('.dreditor-issuecount');

      if (enabled) {
        Drupal.dreditor.triageMode.setup();
      }
    });
  }
};

Drupal.dreditor.triageMode = {
  $container: null
};

Drupal.dreditor.triageMode.setup = function (context) {
  var self = this;
  $('table.project-issue', context).once('dreditor-triage', function () {
    var $table = $(this);
    self.$container = $('<div id="dreditor-column" class="clear-block" style="overflow: hidden; padding-left: 1em;"></div>');
    $table.css({ float: 'left', width: '50%' }).after(self.$container);

    // Hide too verbose columns.
    $table.find('.views-field-field-issue-priority, .views-field-field-issue-category, .views-field-field-issue-component, .views-field-field-issue-assigned').hide();
    $table.find('.views-field-field-issue-status, .views-field-last-comment-timestamp, .views-field-created').hide();
    // Hide updated/new markers.
    $table.find('.marker').hide();

//    $table.find('> * > tr').each(function () {
//      var $tr = $(this);
//      var $newRow = $('<tr class="dreditor-issue-details ' + this.className + '" style="' + $(this).attr('style') + '"></tr>');
//      $tr.after($newRow);
//      var $cells = $tr.children('th, td').not(':first');
//      $cells.appendTo($newRow);
//      $tr.children('th:last, td:last').eq(-0).attr('colspan', $cells.length);
//    });

    $table.find('tbody a').bind('click.issuetriage', function () {
      if (typeof Drupal.behaviors.autocomplete === 'undefined') {
        Drupal.dreditor.loadJS('/misc/autocomplete.js');
      }
      if (typeof Drupal.behaviors.collapse === 'undefined') {
        Drupal.dreditor.loadJS('/misc/collapse.js');
      }
      if (typeof Drupal.behaviors.textarea === 'undefined') {
        Drupal.dreditor.loadJS('/misc/textarea.js');
      }

      // @todo Inject another container into $container for each link being
      //   loaded, assign a HTML id="/node/12345" to it, check whether a
      //   container with ID == this.href exists before loading, and implement
      //   BBQ-style back/next history.

      self.$container.load(this.href + ' #page-subtitle, #main, #aside, #content-bottom-region', Drupal.dreditor.triageMode.onLoad);
      return false;
//      $.get(this.href, function (data) {
//        var $data = $(data).find('#page-inner'); // #column-left + #page-subtitle ?
//        $data.find('#page-title-tools, #nav-content, .breadcrumb').remove();
//        $container.empty().append($data);
//        return false;
//      });
    });
  });
};

Drupal.dreditor.triageMode.onLoad = function () {
  Drupal.attachBehaviors(this); // $container.get(0)
};

Drupal.dreditor.triageMode.teardown = function (context) {
  $('table.project-issue', context).removeOnce('dreditor-triage', function () {
    $('#dreditor-column').remove();
    var $table = $(this);
    $table.find('[class*="views-"]:hidden').show();
    $table.find('.marker').show();
    $table.find('tbody a').unbind('.issuetriage');
  });
};

