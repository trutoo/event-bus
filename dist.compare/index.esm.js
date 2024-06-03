import { validate } from 'jsonschema';
import require$$0 from 'url';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var uri = require$$0;

var ValidationError = function ValidationError (message, instance, schema, path, name, argument) {
  if(Array.isArray(path)){
    this.path = path;
    this.property = path.reduce(function(sum, item){
      return sum + makeSuffix(item);
    }, 'instance');
  }else if(path !== undefined){
    this.property = path;
  }
  if (message) {
    this.message = message;
  }
  if (schema) {
    var id = schema.$id || schema.id;
    this.schema = id || schema;
  }
  if (instance !== undefined) {
    this.instance = instance;
  }
  this.name = name;
  this.argument = argument;
  this.stack = this.toString();
};

ValidationError.prototype.toString = function toString() {
  return this.property + ' ' + this.message;
};

var ValidatorResult = function ValidatorResult(instance, schema, options, ctx) {
  this.instance = instance;
  this.schema = schema;
  this.options = options;
  this.path = ctx.path;
  this.propertyPath = ctx.propertyPath;
  this.errors = [];
  this.throwError = options && options.throwError;
  this.throwFirst = options && options.throwFirst;
  this.throwAll = options && options.throwAll;
  this.disableFormat = options && options.disableFormat === true;
};

ValidatorResult.prototype.addError = function addError(detail) {
  var err;
  if (typeof detail == 'string') {
    err = new ValidationError(detail, this.instance, this.schema, this.path);
  } else {
    if (!detail) throw new Error('Missing error detail');
    if (!detail.message) throw new Error('Missing error message');
    if (!detail.name) throw new Error('Missing validator type');
    err = new ValidationError(detail.message, this.instance, this.schema, this.path, detail.name, detail.argument);
  }

  this.errors.push(err);
  if (this.throwFirst) {
    throw new ValidatorResultError(this);
  }else if(this.throwError){
    throw err;
  }
  return err;
};

ValidatorResult.prototype.importErrors = function importErrors(res) {
  if (typeof res == 'string' || (res && res.validatorType)) {
    this.addError(res);
  } else if (res && res.errors) {
    this.errors = this.errors.concat(res.errors);
  }
};

function stringizer (v,i){
  return i+': '+v.toString()+'\n';
}
ValidatorResult.prototype.toString = function toString(res) {
  return this.errors.map(stringizer).join('');
};

Object.defineProperty(ValidatorResult.prototype, "valid", { get: function() {
  return !this.errors.length;
} });
function ValidatorResultError(result) {
  if(Error.captureStackTrace){
    Error.captureStackTrace(this, ValidatorResultError);
  }
  this.instance = result.instance;
  this.schema = result.schema;
  this.options = result.options;
  this.errors = result.errors;
}
ValidatorResultError.prototype = new Error();
ValidatorResultError.prototype.constructor = ValidatorResultError;
ValidatorResultError.prototype.name = "Validation Error";

/**
 * Describes a problem with a Schema which prevents validation of an instance
 * @name SchemaError
 * @constructor
 */
var SchemaError = function SchemaError (msg, schema) {
  this.message = msg;
  this.schema = schema;
  Error.call(this, msg);
  Error.captureStackTrace(this, SchemaError);
};
SchemaError.prototype = Object.create(Error.prototype,
  {
    constructor: {value: SchemaError, enumerable: false},
    name: {value: 'SchemaError', enumerable: false},
  });

var SchemaContext = function SchemaContext (schema, options, path, base, schemas) {
  this.schema = schema;
  this.options = options;
  if(Array.isArray(path)){
    this.path = path;
    this.propertyPath = path.reduce(function(sum, item){
      return sum + makeSuffix(item);
    }, 'instance');
  }else {
    this.propertyPath = path;
  }
  this.base = base;
  this.schemas = schemas;
};

SchemaContext.prototype.resolve = function resolve (target) {
  return uri.resolve(this.base, target);
};

SchemaContext.prototype.makeChild = function makeChild(schema, propertyName){
  var path = (propertyName===undefined) ? this.path : this.path.concat([propertyName]);
  var id = schema.$id || schema.id;
  var base = uri.resolve(this.base, id||'');
  var ctx = new SchemaContext(schema, this.options, path, base, Object.create(this.schemas));
  if(id && !ctx.schemas[base]){
    ctx.schemas[base] = schema;
  }
  return ctx;
};

var FORMAT_REGEXPS = {
  // 7.3.1. Dates, Times, and Duration
  'date-time': /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-(3[01]|0[1-9]|[12][0-9])[tT ](2[0-4]|[01][0-9]):([0-5][0-9]):(60|[0-5][0-9])(\.\d+)?([zZ]|[+-]([0-5][0-9]):(60|[0-5][0-9]))$/,
  'date': /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-(3[01]|0[1-9]|[12][0-9])$/,
  'time': /^(2[0-4]|[01][0-9]):([0-5][0-9]):(60|[0-5][0-9])$/,
  'duration': /P(T\d+(H(\d+M(\d+S)?)?|M(\d+S)?|S)|\d+(D|M(\d+D)?|Y(\d+M(\d+D)?)?)(T\d+(H(\d+M(\d+S)?)?|M(\d+S)?|S))?|\d+W)/i,

  // 7.3.2. Email Addresses
  // TODO: fix the email production
  'email': /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/,
  'idn-email': /^("(?:[!#-\[\]-\u{10FFFF}]|\\[\t -\u{10FFFF}])*"|[!#-'*+\-/-9=?A-Z\^-\u{10FFFF}](?:\.?[!#-'*+\-/-9=?A-Z\^-\u{10FFFF}])*)@([!#-'*+\-/-9=?A-Z\^-\u{10FFFF}](?:\.?[!#-'*+\-/-9=?A-Z\^-\u{10FFFF}])*|\[[!-Z\^-\u{10FFFF}]*\])$/u,

  // 7.3.3. Hostnames

  // 7.3.4. IP Addresses
  'ip-address': /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  // FIXME whitespace is invalid
  'ipv6': /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/,

  // 7.3.5. Resource Identifiers
  // TODO: A more accurate regular expression for "uri" goes:
  // [A-Za-z][+\-.0-9A-Za-z]*:((/(/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?)?)?#(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|(/(/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~])|/?%[0-9A-Fa-f]{2}|[!$&-.0-;=?-Z_a-z~])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*(#(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*)?|/(/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+(:\d*)?|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?:\d*|\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)?)?
  'uri': /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/,
  'uri-reference': /^(((([A-Za-z][+\-.0-9A-Za-z]*(:%[0-9A-Fa-f]{2}|:[!$&-.0-;=?-Z_a-z~]|[/?])|\?)(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|([A-Za-z][+\-.0-9A-Za-z]*:?)?)|([A-Za-z][+\-.0-9A-Za-z]*:)?\/((%[0-9A-Fa-f]{2}|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|(\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?)?))#(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|(([A-Za-z][+\-.0-9A-Za-z]*)?%[0-9A-Fa-f]{2}|[!$&-.0-9;=@_~]|[A-Za-z][+\-.0-9A-Za-z]*[!$&-*,;=@_~])(%[0-9A-Fa-f]{2}|[!$&-.0-9;=@-Z_a-z~])*((([/?](%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*)?#|[/?])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*)?|([A-Za-z][+\-.0-9A-Za-z]*(:%[0-9A-Fa-f]{2}|:[!$&-.0-;=?-Z_a-z~]|[/?])|\?)(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|([A-Za-z][+\-.0-9A-Za-z]*:)?\/((%[0-9A-Fa-f]{2}|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~])*|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~])+(:\d*)?|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?:\d*|\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~]+)?|[.0-:A-Fa-f]+)\])?)?|[A-Za-z][+\-.0-9A-Za-z]*:?)?$/,
  'iri': /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/,
  'iri-reference': /^(((([A-Za-z][+\-.0-9A-Za-z]*(:%[0-9A-Fa-f]{2}|:[!$&-.0-;=?-Z_a-z~-\u{10FFFF}]|[/?])|\?)(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|([A-Za-z][+\-.0-9A-Za-z]*:?)?)|([A-Za-z][+\-.0-9A-Za-z]*:)?\/((%[0-9A-Fa-f]{2}|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~-\u{10FFFF}])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~-\u{10FFFF}])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|(\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~-\u{10FFFF}])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?)?))#(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|(([A-Za-z][+\-.0-9A-Za-z]*)?%[0-9A-Fa-f]{2}|[!$&-.0-9;=@_~-\u{10FFFF}]|[A-Za-z][+\-.0-9A-Za-z]*[!$&-*,;=@_~-\u{10FFFF}])(%[0-9A-Fa-f]{2}|[!$&-.0-9;=@-Z_a-z~-\u{10FFFF}])*((([/?](%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*)?#|[/?])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*)?|([A-Za-z][+\-.0-9A-Za-z]*(:%[0-9A-Fa-f]{2}|:[!$&-.0-;=?-Z_a-z~-\u{10FFFF}]|[/?])|\?)(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|([A-Za-z][+\-.0-9A-Za-z]*:)?\/((%[0-9A-Fa-f]{2}|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~-\u{10FFFF}])+|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?)(:\d*)?[/?]|[!$&-.0-;=?-Z_a-z~-\u{10FFFF}])(%[0-9A-Fa-f]{2}|[!$&-;=?-Z_a-z~-\u{10FFFF}])*|\/((%[0-9A-Fa-f]{2}|[!$&-.0-9;=A-Z_a-z~-\u{10FFFF}])+(:\d*)?|(\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?:\d*|\[(([Vv][0-9A-Fa-f]+\.[!$&-.0-;=A-Z_a-z~-\u{10FFFF}]+)?|[.0-:A-Fa-f]+)\])?)?|[A-Za-z][+\-.0-9A-Za-z]*:?)?$/u,
  'uuid': /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i,

  // 7.3.6. uri-template
  'uri-template': /(%[0-9a-f]{2}|[!#$&(-;=?@\[\]_a-z~]|\{[!#&+,./;=?@|]?(%[0-9a-f]{2}|[0-9_a-z])(\.?(%[0-9a-f]{2}|[0-9_a-z]))*(:[1-9]\d{0,3}|\*)?(,(%[0-9a-f]{2}|[0-9_a-z])(\.?(%[0-9a-f]{2}|[0-9_a-z]))*(:[1-9]\d{0,3}|\*)?)*\})*/iu,

  // 7.3.7. JSON Pointers
  'json-pointer': /^(\/([\x00-\x2e0-@\[-}\x7f]|~[01])*)*$/iu,
  'relative-json-pointer': /^\d+(#|(\/([\x00-\x2e0-@\[-}\x7f]|~[01])*)*)$/iu,

  // hostname regex from: http://stackoverflow.com/a/1420225/5628
  'hostname': /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/,
  'host-name': /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/,

  'utc-millisec': function (input) {
    return (typeof input === 'string') && parseFloat(input) === parseInt(input, 10) && !isNaN(input);
  },

  // 7.3.8. regex
  'regex': function (input) {
    var result = true;
    try {
      new RegExp(input);
    } catch (e) {
      result = false;
    }
    return result;
  },

  // Other definitions
  // "style" was removed from JSON Schema in draft-4 and is deprecated
  'style': /[\r\n\t ]*[^\r\n\t ][^:]*:[\r\n\t ]*[^\r\n\t ;]*[\r\n\t ]*;?/,
  // "color" was removed from JSON Schema in draft-4 and is deprecated
  'color': /^(#?([0-9A-Fa-f]{3}){1,2}\b|aqua|black|blue|fuchsia|gray|green|lime|maroon|navy|olive|orange|purple|red|silver|teal|white|yellow|(rgb\(\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*\))|(rgb\(\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*\)))$/,
  'phone': /^\+(?:[0-9] ?){6,14}[0-9]$/,
  'alpha': /^[a-zA-Z]+$/,
  'alphanumeric': /^[a-zA-Z0-9]+$/,
};

FORMAT_REGEXPS.regexp = FORMAT_REGEXPS.regex;
FORMAT_REGEXPS.pattern = FORMAT_REGEXPS.regex;
FORMAT_REGEXPS.ipv4 = FORMAT_REGEXPS['ip-address'];

var makeSuffix = function makeSuffix (key) {
  key = key.toString();
  // This function could be capable of outputting valid a ECMAScript string, but the
  // resulting code for testing which form to use would be tens of thousands of characters long
  // That means this will use the name form for some illegal forms
  if (!key.match(/[.\s\[\]]/) && !key.match(/^[\d]/)) {
    return '.' + key;
  }
  if (key.match(/^\d+$/)) {
    return '[' + key + ']';
  }
  return '[' + JSON.stringify(key) + ']';
};

var deepCompareStrict = function deepCompareStrict (a, b) {
  if (typeof a !== typeof b) {
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    return a.every(function (v, i) {
      return deepCompareStrict(a[i], b[i]);
    });
  }
  if (typeof a === 'object') {
    if (!a || !b) {
      return a === b;
    }
    var aKeys = Object.keys(a);
    var bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every(function (v) {
      return deepCompareStrict(a[v], b[v]);
    });
  }
  return a === b;
};

var PayloadMismatchError = /** @class */ (function (_super) {
    __extends(PayloadMismatchError, _super);
    /**
     * Creates a new PayloadMismatchError error
     * @param channel - name of event channel
     * @param schema - registered schema on event channel
     * @param payload - payload detail sent
     */
    function PayloadMismatchError(channel, schema, payload) {
        var _this = _super.call(this, "payload does not match the specified schema for channel [".concat(channel, "].")) || this;
        _this.channel = channel;
        _this.schema = schema;
        _this.payload = payload;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, PayloadMismatchError);
        }
        _this.name = 'PayloadMismatchError';
        return _this;
    }
    return PayloadMismatchError;
}(Error));
var SchemaMismatchError = /** @class */ (function (_super) {
    __extends(SchemaMismatchError, _super);
    /**
     * Creates a new SchemaMismatchError error
     * @param channel - name of event channel
     * @param schema - registered schema on event channel
     * @param newSchema - new schema attempting to be registered on event channel
     */
    function SchemaMismatchError(channel, schema, newSchema) {
        var _this = _super.call(this, "schema registration for [".concat(channel, "] must match already registered schema.")) || this;
        _this.channel = channel;
        _this.schema = schema;
        _this.newSchema = newSchema;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, SchemaMismatchError);
        }
        _this.name = 'SchemaMismatchError';
        return _this;
    }
    return SchemaMismatchError;
}(Error));
var EventBus = /** @class */ (function () {
    function EventBus() {
        this._lastId = 0;
        this._subscriptions = {};
    }
    EventBus.prototype._getNextId = function () {
        return this._lastId++;
    };
    /**
     * Register a schema for the specified channel and equality checking on subsequent registers.
     * Subsequent registers must use an equal schema or an error will be thrown.
     * @param channel - name of event channel to register schema to
     * @param schema - all communication on channel must follow this schema
     * @returns returns true if event channel already existed of false if a new one was created
     *
     * @throws {@link SchemaMismatchError}
     * This exception is thrown if new schema does not match already registered schema.
     */
    EventBus.prototype.register = function (channel, schema) {
        var exists = true;
        if (!this._subscriptions[channel]) {
            exists = false;
            this._subscriptions[channel] = {};
        }
        var registered = this._subscriptions[channel].__schema;
        if (registered && !deepCompareStrict(registered, schema)) {
            throw new SchemaMismatchError(channel, registered, schema);
        }
        this._subscriptions[channel].__schema = schema;
        return exists;
    };
    /**
     * Unregister the schema for the specified channel if channel exists.
     * @param channel - name of event channel to unregister schema from
     * @returns returns true if event channel existed and an existing schema was removed
     */
    EventBus.prototype.unregister = function (channel) {
        var subscriptions = this._subscriptions[channel];
        var exists = false;
        if (subscriptions && subscriptions.__schema) {
            exists = true;
            delete subscriptions.__schema;
        }
        return exists;
    };
    EventBus.prototype.subscribe = function (channel, param2, param3) {
        var id = this._getNextId();
        var replay = typeof param2 === 'boolean' ? param2 : false;
        var callback = typeof param2 === 'function' ? param2 : param3;
        if (typeof callback !== 'function')
            throw new Error('Callback function must be supplied as either the second or third argument.');
        var channelObject = this._subscriptions[channel];
        if (!channelObject)
            channelObject = this._subscriptions[channel] = {};
        else if (replay)
            callback({ channel: channel, payload: channelObject.__replay });
        channelObject[id] = callback;
        return {
            unsubscribe: function () { return delete channelObject[id]; },
        };
    };
    /**
     * Publish to event channel with an optional payload triggering all subscription callbacks.
     * @param channel - name of event channel to send payload on
     * @param payload - payload to be sent
     *
     * @throws {@link PayloadMismatchError}
     * This exception is thrown if payload does is not valid against registered schema.
     */
    EventBus.prototype.publish = function (channel, payload) {
        var channelObject = this._subscriptions[channel];
        if (!channelObject)
            channelObject = this._subscriptions[channel] = {};
        var schema = channelObject.__schema;
        if (typeof payload !== 'undefined' && schema && !validate(payload, schema).valid) {
            throw new PayloadMismatchError(channel, schema, payload);
        }
        channelObject.__replay = payload;
        for (var id in channelObject) {
            // istanbul ignore if - ignore robustness check
            if (id === '__replay' || id === '__schema')
                continue;
            if (typeof channelObject[id] !== 'function')
                continue;
            channelObject[id]({ channel: channel, payload: payload });
        }
        // Publish all events on the wildcard channel
        channelObject = this._subscriptions['*'];
        if (channelObject) {
            for (var id in channelObject) {
                // istanbul ignore if - ignore robustness check
                if (id === '__replay' || id === '__schema')
                    continue;
                if (typeof channelObject[id] !== 'function')
                    continue;
                channelObject[id]({ channel: channel, payload: payload });
            }
        }
    };
    /**
     * Get the latest published payload on the specified event channel.
     * @param channel - name of the event channel to fetch the latest payload from
     * @returns the latest payload or `undefined`
     */
    EventBus.prototype.getLatest = function (channel) {
        if (this._subscriptions[channel])
            return this._subscriptions[channel].__replay;
    };
    /**
     * Get the schema registered on the specified event channel.
     * @param channel - name of the event channel to fetch the schema from
     * @returns the schema or `undefined`
     */
    EventBus.prototype.getSchema = function (channel) {
        if (this._subscriptions[channel])
            return this._subscriptions[channel].__schema;
    };
    return EventBus;
}());

var getGlobal = function () {
    /* istanbul ignore next */
    if (typeof self !== 'undefined') {
        return self;
    }
    /* istanbul ignore next */
    if (typeof window !== 'undefined') {
        return window;
    }
    /* istanbul ignore next */
    if (typeof global !== 'undefined') {
        return global;
    }
    /* istanbul ignore next */
    throw new Error('unable to locate global object');
};
getGlobal().eventBus = new EventBus();

export { EventBus, getGlobal };
