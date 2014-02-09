/**
 * PoormansVBO. Or next generation UX.
 *
 * @todo What a ugly mess.  detachBehaviors, anyone?
 */
Drupal.behaviors.dreditorIssueBulkOperations = {
  attach: function (context) {
    $('table.project-issue', context).once('dreditor-issue-bulk-operations', function () {
      var $table = $(this);
      var $checkall = $('<input type="checkbox" name="bulkupdate" value="all" />').prependTo('table.project-issue thead th:first');
      var $filter = $('.view-filters form');
      var $form;

      var setUp = function () {
        var hasProjectColumn = $(this).parents('table').find('thead th:contains("Project")').length;
        // Ensure we have autocomplete.js.
        if (typeof Drupal.behaviors.autocomplete === 'undefined') {
          Drupal.dreditor.loadJS('/misc/autocomplete.js');
        }
        // Inject bulk operation checkboxes.
        var $checkbox = $('<input class="dreditor-issue-bulk-update" type="checkbox" />');
        $(this).parents('table').find('tbody tr').each(function () {
          var $td = $(this).children('td:first');
          var node_url = $(this).find('a').eq(hasProjectColumn ? 1 : 0).attr('href');
          $checkbox.clone().attr('value', node_url).prependTo($td);
        });

        // Clone issue filter into issue update form.
        $form = $filter.clone().removeAttr('id').removeAttr('action');
        $filter.hide();

        // Remove search text and form submit button.
        $form.find('.views-exposed-widget:has(input[name="text"], .form-submit)').remove();
        // Remove invalid values.
        $form.find('option[value="Open"], option[value*=".x"], option[value="All"]').remove();
        // Remove fields that cannot be updated.
        $form.find('.views-exposed-widget:has(input[name="assigned"], input[name="submitted"], input[name="participant"])').remove();

        // Replace views filter field attributes to match issue comment form.
        // "Project" field is only contained in cross-project queues.
        $form.find(':input[name="projects"]').attr({ name: 'project_info[project_title]' });
        $form.find(':input[name^="status"]').attr({ name: 'sid', size: 1, multiple: false });
        $form.find(':input[name^="version"]').attr({ name: 'project_info[rid]', size: 1, multiple: false });
        $form.find(':input[name^="component"]').attr({ name: 'project_info[component]', size: 1, multiple: false });
        $form.find(':input[name^="categories"]').attr({ name: 'category', size: 1, multiple: false });
        $form.find(':input[name^="priorities"]').attr({ name: 'priority', size: 1, multiple: false });

        $form.find('select[name^="' + name + '"]').not(':has(option[value=""])').each(function () {
          $(this).find('option').removeAttr('selected');
          $(this).prepend('<option value="" selected="selected">--</option>');
        });

        // Fix autocomplete for "Project" field, if existent.
        $form.find('#edit-projects').attr({ id: 'projects', value: '' }).next().remove();
        $form.find('#edit-projects-autocomplete').attr({ id: 'projects-autocomplete' })
          .removeClass('autocomplete-processed');

        // Inject issue tags fields to add or remove tags.
        // Cross-project queue views already contain a fully prepared field;
        // directly use that as base if available.
        var $addTags = $form.find('.views-exposed-widget:has(input[name="issue_tags"])');
        if ($addTags.length) {
          // Remove issue tag view filter operation.
          $addTags.find('.views-operator:has(:input[name="issue_tags_op"])').remove();
          $addTags.find('input.autocomplete').removeClass('autocomplete-processed');
        }
        else {
          // Build from scratch.
          $addTags = $(
            '<div class="views-exposed-widget">' +
            '<label>Issue tags</label><div class="views-widget">' +
              '<div class="form-item"><input id="edit-issue-tags" type="text" class="form-text form-autocomplete" value="" size="32" name="issue_tags" maxlength="128" /></div>' +
              '<input id="edit-issue-tags-autocomplete" class="autocomplete" type="hidden" value="' + location.protocol + '//' + location.host + '/taxonomy/autocomplete/9" disabled="disabled" />' +
            '</div></div>');
          $form.find('.views-exposed-widgets').append($addTags);
        }
        // Duplicate issue tags field into add and remove.
        var $removeTags = $addTags.clone();
        $addTags
          .find('label').text('Add tags').end()
          .find('input[name="issue_tags"]').attr({ id: 'tags-add', name: 'issue_tags_add', value: '' }).end()
          .find('input.autocomplete').attr({ id: 'tags-add-autocomplete' });
        var $removeAllTags = $('<input type="checkbox" name="issue_tags_remove_all" id="tags-remove-all" />')
          .change(function () {
            $('#tags-remove').attr({ disabled: this.checked ? true : false });
          });
        $removeTags
          .find('label').text('Remove tags').end()
          .find('input[name="issue_tags"]').attr({ id: 'tags-remove', name: 'issue_tags_remove', value: '' }).end()
          .find('input.autocomplete').attr({ id: 'tags-remove-autocomplete' }).end()
          // Label needs to be appended here; .after() on disconnected DOM nodes
          // requires jQuery 1.4+.
          .find('div.form-item').addClass('container-inline').append($removeAllTags, '<label for="tags-remove-all">Remove all</label>');
        $addTags.after($removeTags);

        // Add comment textarea.
        $form.append('<div class="form-item"><textarea class="form-textarea resizable" name="comment" rows="2" cols="40" /></div>');
        var $actions = $('<div class="form-actions" />').appendTo($form);

        // Add BO submit button.
        $('<input class="dreditor-button" type="submit" value="Bulk update" />').prependTo($actions).click(function () {
          // Prevent submitting the form when pressing ENTER for an autocomplete.
          // @see http://drupal.org/node/634616
          if ($('#autocomplete').length) {
            return false;
          }
          // Remove empty values.
          var values = {}, hasValues = false;
          $.each($form.serializeArray(), function () {
            if (this.value.length) {
              values[this.name] = this.value;
              hasValues = true;
            }
          });
          if (!hasValues) {
            return cancel();
          }
          var tagChanges = {};
          $.each(['issue_tags_remove_all', 'issue_tags_remove', 'issue_tags_add'], function (i, name) {
            tagChanges[name] = values[name];
            delete values[name];
          });
          // @todo Progress bar? :) Until there is one, lock the browser.
          $.ajaxSetup({ async: false });
          // Bulk update issues.
          $('input.dreditor-issue-bulk-update:checked', $table).each(function () {
            var url = '/comment/reply/' + this.value.match(/\d+$/);
            $.get(url, function (data) {
              var $commentForm = $(data).find('form#comment-form');
              // Handle addition and removal of issue tags.
              var $tagsField = $commentForm.find(':input[name="taxonomy[tags][9]"]');
              if ($tagsField.length) {
                var tags = [];
                if (!tagChanges.issue_tags_remove_all) {
                  // Issue tags default value is guaranteed to be properly
                  // delimited, so no trim() required.
                  if ($tagsField.val()) {
                    tags = $tagsField.val().split(', ');
                  }
                }
                if (tagChanges.issue_tags_remove) {
                  $.each(tagChanges.issue_tags_remove.split(','), function (i, tag) {
                    i = $.inArray($.trim(tag), tags);
                    if (i > -1) {
                      tags.splice(i, 1);
                    }
                  });
                }
                if (tagChanges.issue_tags_add) {
                  $.each(tagChanges.issue_tags_add.split(','), function (i, tag) {
                    tags.push($.trim(tag));
                  });
                }
                $tagsField.val(tags.join(', '));
              }
              // Populate the comment form fields.
              $.each(values, function (name, update) {
                $commentForm.get(0)[name].value = update;
              });
              // If we end up here, then we had at least one non-empty value; make
              // sure we don't get a "Change at least one... yadayada"; e.g., when
              // only altering tags.
              $commentForm.get(0).comment.value += ' ';

              // jQuery does not serialize submit button values.
              var edit = $commentForm.serialize() + '&op=Save';
              $.post($commentForm.get(0).action, edit);
            });
          });

          // Redirect to origin.
          Drupal.dreditor.redirect();
          return false;
        });
        // Add Cancel link.
        $('<input class="dreditor-button" type="button" value="Cancel" />').appendTo($actions).click(function () {
          return cancel();
        });

        // Add form.
        $filter.after($form);
        Drupal.attachBehaviors($form.get(0));

        // Don't check all upon first click.
        return false;
      };

      var cancel = function () {
        $form.remove();
        $filter.show();
        $table.find('tbody input').remove();
        $checkall.get(0).checked = false;
        $checkall.one('click', setUp);
        return false;
      };

      $checkall
        // @todo Use propagation methods in jQuery 1.3+, instead of relying on
        //   fragile event binding order.
        .click(function () {
          if ($form) {
            var checked = this.checked;
            $table.find('tbody tr td :checkbox').each(function () {
              this.checked = checked;
            });
          }
        })
        .one('click', setUp);
    });
  }
};
