<?php 
require_once __DIR__."/setup.php";

use Parse\ParseCloud;
use Parse\ParseUser;
use Parse\ParseException;
use Parse\ParseObject;

$testNumber = 1; 

UITest::display_title(basename(__FILE__));

TestSetup::loadUsers(1);
TestSetup::addService(0, (new \Datetime("now"))->add(new \DateInterval("P2M")), "service 1", "description of service 1");


try{
	$message = $service = $serviceConfiguration = null;

	UserObjectTest::LoginMustSucceed(TestSetup::getUsername(0));

	$result = ParseCloudTest::runMustSucceed(
		'write_message', 
		[
			"serviceId" => TestSetup::getService(0)->getObjectId(),
			"summary" => "summary 1",
			"content" => "content 1"
		], 
		false);
	$resultJson = json_decode($result);
	$messageId = $resultJson->messageId;

	$message = new ParseObject("Message", $messageId);
	ParseObjectTest::fetchMustSucceed($message, false);

	$result = ParseCloudTest::runMustSucceed(
		'add_messagesusers', 
		[
			"serviceId" => TestSetup::getService(0)->getObjectId(),
			"messagesUsers" => 100
		], 
		true);

	$resultJson = json_decode($result);
	$serviceId = $resultJson->serviceId;

	$service = new ParseObject("Service", $serviceId);
	ParseObjectTest::fetchMustSucceed($service, true);

	$serviceConfiguration = $service->get("configuration");
	ParseObjectTest::fetchMustSucceed($serviceConfiguration, true);

	//BasicTest::compareMustBeEqual($message->get('service')->getObjectId(), TestSetup::getService(0)->getObjectId());
	BasicTest::compareMustBeEqual($serviceConfiguration->get('messagesUsers'), 100);

	$serviceConfiguration->set("subscriptions", 10);
	ParseObjectTest::saveMustSucceed($serviceConfiguration, true);

	$result = ParseCloudTest::runMustSucceed(
		'send', 
		[
			"serviceId" => TestSetup::getService(0)->getObjectId(),
			"messageId" => $message->getObjectId()
		], 
		false);

	ParseObjectTest::fetchMustSucceed($serviceConfiguration, true);
	BasicTest::compareMustBeEqual($serviceConfiguration->get('messagesUsers'), 90);

	UITest::display_result(true, "Add messagesUsers");
}catch(Exception $e){
	print_r($e);
	UITest::display_result(false, "Add messagesUsers", $e);
}
