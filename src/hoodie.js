'use strict';

// Hoodie
// --------
//
// the door to world domination (apps)
//

var stampit = require('utils/stampit');
var events = require('utils/events');
var defer = require('utils/defer');
var uuid = require('utils/uuid');

var state = {
  online : true
};

var methods = {

  // Requests
  // ----------

  // use this method to send requests to the hoodie backend.
  //
  //     promise = hoodie.request('GET', '/user_database/doc_id')
  //
  request: function(type, url, options) {
    var defaults, requestPromise, pipedPromise;

    options = options || {};

    // if a relative path passed, prefix with @baseUrl
    if (!/^http/.test(url)) {
      url = "" + this.baseUrl + url;
    }

    defaults = {
      type: type,
      url: url,
      xhrFields: { withCredentials: true },
      crossDomain: true,
      dataType: 'json'
    };

    // we are piping the result of the request to return a nicer
    // error if the request cannot reach the server at all.
    // We can't return the promise of $.ajax directly because of
    // the piping, as for whatever reason the returned promise 
    // does not have the `abort` method any more, maybe others
    // as well. See also http://bugs.jquery.com/ticket/14104
    requestPromise = $.ajax($.extend(defaults, options));
    pipedPromise = requestPromise.then( null, pipeRequestError);
    pipedPromise.abort = requestPromise.abort;

    return pipedPromise;
  },


  // Check Connection
  // ------------------

  // the `checkConnection` method is used, well, to check if
  // the hoodie backend is reachable at `baseUrl` or not.
  // Check Connection is automatically called on startup
  // and then each 30 seconds. If it fails, it
  //
  // - sets `hoodie.online = false`
  // - triggers `offline` event
  // - sets `checkConnectionInterval = 3000`
  //
  // when connection can be reestablished, it
  //
  // - sets `hoodie.online = true`
  // - triggers `online` event
  // - sets `checkConnectionInterval = 30000`
  //
  checkConnection: function() {

    var req = checkConnectionRequest;

    if (req && req.state() === 'pending') {
      return req;
    }

    checkConnectionRequest = this.request('GET', '/').pipe(
      handleCheckConnectionSuccess,
      handleCheckConnectionError
    );

    return checkConnectionRequest;
  },


  // Open stores
  // -------------

  // generic method to open a store. Used by
  //
  // * hoodie.remote
  // * hoodie.user("joe")
  // * hoodie.global
  // * ... and more
  //
  //     hoodie.open("some_store_name").findAll()
  //
  open: function(storeName, options) {
    options = options || {};

    $.extend(options, {
      name: storeName
    });

    return new Hoodie.Remote(this, options);
  },


  // uuid
  // ------

  // helper to generate unique ids.
  uuid: uuid,

  // Defers / Promises
  // -------------------

  // returns a defer object for custom promise handlings.
  // Promises are heavely used throughout the code of hoodie.
  // We currently borrow jQuery's implementation:
  // http://api.jquery.com/category/deferred-object/
  //
  //     defer = hoodie.defer()
  //     if (good) {
  //       defer.resolve('good.')
  //     } else {
  //       defer.reject('not good.')
  //     }
  //     return defer.promise()
  //
  defer: defer,


  // dispose
  // ---------

  // if a hoodie instance is not needed anymore, it can
  // be disposed using this method. A `dispose` event
  // gets triggered that the modules react on.
  dispose : function() {
    this.trigger('dispose');
  },


  // Extending hoodie
  // ------------------

  // You can either extend the Hoodie class, or a hoodie
  // instance dooring runtime
  //
  //     hoodieClass = require('hoodie');
  //     hoodieClass.extend('magic1', funcion(hoodie) { /* ... */ })
  //     hoodie = hoodieClass()
  //     hoodie.extend('magic2', function(hoodie) { /* ... */ })
  //     hoodie.magic1.doSomething()
  //     hoodie.magic2.doSomethingElse()
  //
  extend : function(name, Module) {
    this[name] = new Module(this);
  }

  // QUESTION: Where to put "class" methods?
  // 
  // Hoodie.extend = function(name, Module) {
  //   extensions = extensions || {};
  //   extensions[name] = Module;
  // };
};

// 
// Private
// ------------
// 

var checkConnectionInterval = 30000;
var checkConnectionRequest;
var extensions;

// if server cannot be reached at all, return a meaningfull error
// 
function pipeRequestError(xhr) {
  var error;

  try {
    error = JSON.parse(xhr.responseText);
  } catch (_error) {
    error = {
      error: xhr.responseText || ("Cannot connect to Hoodie server at " + this.baseUrl)
    };
  }

  return this.rejectWith(error).promise();
};

//
function loadExtensions() {
  var Module, instanceName;

  for (instanceName in extensions) {
    if (extensions.hasOwnProperty(instanceName)) {
      Module = extensions[instanceName];

      // how to init the modules and expose them on the hoodie instance?
      this[instanceName] = new Module(this);
    }
  }
};


//
function handleCheckConnectionSuccess() {
  checkConnectionInterval = 30000;

  // how to call instance methods from the private methods?
  window.setTimeout(methods.checkConnection, checkConnectionInterval);

  if (!state.online) {

    // how to call mixed in methods from the private methods?
    events.trigger('reconnected');
    state.online = true;
  }

  return defer().resolve();
}


//
function handleCheckConnectionError() {
  checkConnectionInterval = 3000;

  window.setTimeout(methods.checkConnection, checkConnectionInterval);

  if (state.online) {
    events.trigger('disconnected');
    state.online = false;
  }

  return defer().reject();
}


module.export = stampit(methods, state).mixin(events);


// WHERE TO THE FORMER CONSTRUCTION LOGIC?
// 
// // Constructor
// // -------------

// // When initializing a hoodie instance, an optional URL
// // can be passed. That's the URL of a hoodie backend.
// // If no URL passed it defaults to the current domain
// // with an `api` subdomain.
// //
// //     // init a new hoodie instance
// //     hoodie = new Hoodie
// //
// function Hoodie(baseUrl) {
//   this.baseUrl = baseUrl;
//
//   // remove trailing slash(es)
//   this.baseUrl = this.baseUrl ? this.baseUrl.replace(/\/+$/, '') : "/_api";
//
//   // init core modules
//   this.store = new this.constructor.LocalStore(this);
//   this.config = new this.constructor.Config(this);
//   this.account = new this.constructor.Account(this);
//   this.remote = new this.constructor.AccountRemote(this);
//
//   loadExtensions();
//   this.checkConnection();
// }
// Object.deepExtend(Hoodie, _super);
