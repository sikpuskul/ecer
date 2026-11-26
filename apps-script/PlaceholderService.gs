/**
 * PlaceholderService.gs — Ekstraksi dan penggantian placeholder {{snake_case}}.
 */
var PLACEHOLDER_REGEX = /\{\{([a-z][a-z0-9_]{0,63})\}\}/g;
var BROKEN_BRACE_REGEX = /\{\{[^}]*\}|\{[^{]*\}\}/g;

function extractPlaceholdersFromDoc_(doc) {
  var found = {};
  var warnings = [];

  var sections = [doc.getBody(), doc.getHeader(), doc.getFooter()];
  for (var i = 0; i < sections.length; i++) {
    var section = sections[i];
    if (!section) continue;
    var text = section.getText() || '';
    var match;
    PLACEHOLDER_REGEX.lastIndex = 0;
    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      found[match[1]] = true;
    }

    var stripped = text.replace(PLACEHOLDER_REGEX, '');
    if (stripped.indexOf('{{') !== -1 || stripped.indexOf('}}') !== -1) {
      warnings.push(
        'Ditemukan kurung kurawal placeholder yang tidak lengkap atau tidak sesuai format {{snake_case}}.',
      );
    }
  }

  return {
    placeholders: Object.keys(found).sort(),
    warnings: warnings,
  };
}

function escapeRegexForDocs_(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePlaceholdersInDoc_(doc, valuesMap) {
  var sections = [doc.getBody(), doc.getHeader(), doc.getFooter()];
  var keys = Object.keys(valuesMap || {});

  for (var s = 0; s < sections.length; s++) {
    var section = sections[s];
    if (!section) continue;

    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (key === 'qr_code') continue;
      var token = '{{' + key + '}}';
      var replacement = String(valuesMap[key] == null ? '' : valuesMap[key]);
      section.replaceText(escapeRegexForDocs_(token), replacement);
    }
  }
}
