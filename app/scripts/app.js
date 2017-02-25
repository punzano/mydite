(function(document) {
  'use strict';

  // Grab a reference to our auto-binding template
  // and give it some initial binding values
  // Learn more about auto-binding templates at http://goo.gl/Dx1u2g
  var app = document.querySelector('#app');

  var ref = new Firebase("https://mydite.firebaseio.com");
  var authData = ref.getAuth();
  if (authData) app["isUserAuth"] = true;
  else app["isUserAuth"] = false;

  // Sets app default base URL
  app.baseUrl = '/';
  if (window.location.port === '') {  // if production
    // Uncomment app.baseURL below and
    // set app.baseURL to '/your-pathname/' if running from folder in production
    // app.baseUrl = '/polymer-starter-kit/';
  }

  app.displayInstalledToast = function() {
    // Check to make sure caching is actually enabled—it won't be in the dev environment.
    if (!Polymer.dom(document).querySelector('platinum-sw-cache').disabled) {
      Polymer.dom(document).querySelector('#caching-complete').show();
    }
  };

  // Listen for template bound event to know when bindings
  // have resolved and content has been stamped to the page
  app.addEventListener('dom-change', function() {

  });

  app.closeDrawer = function() {
    app.$.paperDrawerPanel.closeDrawer();
  };

  window.addEventListener('WebComponentsReady', function() {
    // imports are loaded and elements have been registered
  });

  window.addEventListener('resize', function() {
    if(window.location.href.indexOf('acceso') != -1 && window.innerWidth >= parseInt(document.querySelector('#paperDrawerPanel').responsiveWidth.replace( /^\D+/g, ''))){
      page.redirect('/');
      document.querySelector('#signInDropdown').open();
    }
  });

})(document);
