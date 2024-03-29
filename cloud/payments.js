require('./function.create_service.js');
require('./function.add_messagesusers.js');
require('./function.parse_str.js')
require('./function.paypal.js')

Parse.Cloud.define("paypal_set_express_checkout", function(request, response) {

  	Parse.Cloud.useMasterKey();

	if (!request.user ||!request.params.packageName ){
    	error_response(request,response, 002);
	}

  	if ( request.params.sandbox ){
    	var sandbox = true;
    }else{
		var sandbox = false;
	}

	var package = null ; 
	var purchase = null ;
	var price = null ; 
	var purchase_params = {} ; 

	var Package = Parse.Object.extend("Package");
  	var Purchase = Parse.Object.extend("Purchase");
  	var packageQuery = new Parse.Query(Package);
  	packageQuery.equalTo('canonicalName', request.params.packageName);
  	
  	packageQuery.first(true).then(
  		function(object){
  			package = object;
  			var params = package.get("params");
  			var size = params.length;
		   	for (var index = 0; index < size; ++index) {
		   		if (!request.params[params[index]]){
			    	error_response(request,response, 003);
    				throw new Error();
				}
		   		purchase_params[params[index]] = request.params[params[index]];
			}

  			price = package.get("price");

  			return Parse.Cloud.httpRequest({
			  url: (sandbox)?paypal_url_sandbox:paypal_url,
			  params: {
			    USER: (sandbox)?paypal_credentials_dev_user:paypal_credentials_prod_user,
			    PWD: (sandbox)?paypal_credentials_dev_password:paypal_credentials_prod_password,
			    SIGNATURE: (sandbox)?paypal_credentials_dev_signature:paypal_credentials_prod_signature,
			    METHOD:"SetExpressCheckout",
			    VERSION:"93",
			    PAYMENTREQUEST_0_PAYMENTACTION:"SALE",
			    PAYMENTREQUEST_0_AMT:price,
			    PAYMENTREQUEST_0_CURRENCYCODE:"EUR",
			    RETURNURL:"http://www.example.com/success.html",
			    CANCELURL:"http://www.example.com/cancel.html"
			  }
			});
  		}
  	).then(
  		function(httpResponse){
		   	var nvp = [];
		   	parse_str(httpResponse.text, nvp);
		   	token = nvp["TOKEN"];

			purchase = new Purchase();

			purchase.set("user", request.user);
			purchase.set("package", package);
			purchase.set("paiement_method", (sandbox)?"paypal_sandbox":"paypal");
			purchase.set("token", token);
			purchase.set("status", "pending");
			purchase.set("message", "");
			purchase.set("amount", price);
			purchase.set("params", purchase_params);
			purchase.set("infos", "");

			return purchase.save(true);
  		}
  	).then(
  		function(){
		  if ( sandbox ){
			response.success('{"token":"'+token+'","url":"https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token='+token+'"}');
		  }else{
			response.success('{"token":"'+token+'","url":"https://www.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token='+token+'"}');
		  }
		},
  		function(error){
			error_response(request,response, 600, error);

  		}
  	);
});



Parse.Cloud.define("paiement_check", function(request, response) {

  	if ( !request.params.paiement_token ){
    	error_response(request,response, 002);
  	}

  	var Purchase = Parse.Object.extend("Purchase");
  	var purchaseQuery = new Parse.Query(Purchase);
  	purchaseQuery.equalTo('token', request.params.paiement_token);
  	purchaseQuery.include("package");

  	var purchase = null ; 
  	var package = null;
  	var payer_id = null; 

	purchaseQuery.first().then(
		function(object) {
	      purchase = object;
	      package = purchase.get("package");
	      var paiement_method = purchase.get("paiement_method");

	      if (paiement_method == "paypal"){
	      	return paypal_check_payment(false, purchase);
	      }else if (paiement_method == "paypal_sandbox"){
  			return paypal_check_payment(true, purchase);
	      }else if(paiement_method == "free"){

	      }else{

	      }
		}
	).then(
		function(object) {
	      var params = purchase.get("params");
	      var values = package.get("values");
		  
		  purchase.set("status","paid-error");
	      
	      if (package.get("type") == "creation"){
	      	return create_service(
		        purchase.get("user"), 
		        params["name"], 
		        params["description"], 
		        values["messagesusers"]);

	      }else if(package.get("type") == "rent"){

	      }else if(package.get("type") == "messagesusers"){

			var Service = Parse.Object.extend("Service");
			var service = new Service();
			service.id = params["serviceId"];
  			return service.fetch(true).then(
  					function(object){
  						return service.get("configuration").fetch();
  					}
  				).then(
  					function(object){
  						return add_messagesusers(object, values["messagesusers"]);
  					}
  				);
	      }else{
		      purchase.set("message","unknown type");
	      }
	      return purchase.save();
	    }
	).then(
		function(object) {
	      purchase.set("status","complete");
	      return purchase.save();
	    }
	).then(
		function(object){
			success_response(request,response, 600);
		},
		function(error){
			error_response(request,response, 600, error);
		}
	)

});


