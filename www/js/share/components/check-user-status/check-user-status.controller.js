/**
 * @name Check User Status controller
 * @author Nazanin Reihani Haghighi
 * @contributors []
 * @since 02/15/2017
 * @copyright Binary Ltd
 */

(function() {
    'use strict';

    angular
        .module('binary.share.components.check-user-status.controllers')
        .controller('CheckUserStatusController', CheckUserStatus);

    CheckUserStatus.$inject = ['$scope', '$state', '$translate', '$ionicSideMenuDelegate', 'websocketService', 'appStateService', 'alertService', 'accountService'];

    function CheckUserStatus($scope, $state, $translate, $ionicSideMenuDelegate, websocketService, appStateService, alertService, accountService) {
        var vm = this;
        vm.isLoggedIn = false;
        vm.notUpdatedTaxInfo = false;
        vm.isFinancial = false;
        vm.state = {};
        // write them based on priority please
        vm.redirectPriority = ['terms-and-conditions', 'financial-assessment', 'tax-information'];

        $scope.$on('authorize', () => {
            if (!vm.isLoggedIn) {
                vm.isLoggedIn = true;
                websocketService.sendRequestFor.getAccountStatus();
            }
        });

        // check if user has high risk
        $scope.$on('get_account_status', (e, get_account_status) => {
            if (get_account_status.risk_classification === 'high') {
                appStateService.hasHighRisk = true;
                websocketService.sendRequestFor.getFinancialAssessment();
            }
            else{
              vm.state.financialAssessment = true;
            }
            if (get_account_status.hasOwnProperty('status') && (get_account_status.status).indexOf('crs_tin_information') < 0) {
                vm.notUpdatedTaxInfo = true;
                vm.checkTaxInformation();
            }
            else{
              vm.state.taxInformation = true;
            }
        });

        // get the financial Assessment of user and check if is empty and user has high risk so must set them
        $scope.$on('get_financial_assessment:success', (e, get_financial_assessment) => {
            if (_.isEmpty(get_financial_assessment) && appStateService.hasHighRisk) {
                appStateService.hasToRedirectToFinancialAssessment = true;
            }
            vm.state.financialAssessment = true;
        });


        // get terms and onditions
        $scope.$on('get_settings', (e, get_settings) => {
            if (get_settings) {
                vm.clientTncStatus = get_settings.client_tnc_status;
                vm.termsConditionsVersion = localStorage.getItem('termsConditionsVersion');
                if (!appStateService.virtuality && vm.clientTncStatus !== vm.termsConditionsVersion) {
                    appStateService.hasToRedirectToTermsAndConditions = true;
                }
                vm.state.termsAndConditions = true;
            }
        });


        // check for tax information
        vm.checkFinancial = function() {
            vm.account = accountService.getDefault();
            vm.isFinancial = _.startsWith(vm.account.id, "MF") ? true : false;
        }
        vm.checkTaxInformation = function() {
            vm.checkFinancial();
            if (vm.isFinancial && vm.notUpdatedTaxInfo) {
                appStateService.hasToRedirectToTaxInformation = true;
            }
            vm.state.taxInformation = true;
        }



        // cases
        vm.redirect = function() {
            if (vm.redirectPriority.length > 0) {
                for (var key = 0; key < vm.redirectPriority.length; key++) {
                    var value = vm.redirectPriority[key];
                    if (appStateService['hasToRedirectTo' + _.upperFirst(_.camelCase(value))]) {
                      vm.redirectPriority.shift();
                        $state.go(value);
                        if($ionicSideMenuDelegate.isOpen()) $ionicSideMenuDelegate.toggleLeft();
                        break;
                    }
                    else{
                      vm.redirectPriority.shift();
                      vm.redirect();
                    }
                }
            } else {
                $state.go('trade');
            }

        }

        // callback
        // check if all data are recieved and all redirect necesseries are ready
        $scope.$watch('vm.state', () => {
          if(_.size(vm.state) === vm.redirectPriority.length){
            vm.redirect();
          }
        }, true);

        // successes
        $scope.$on('tnc_approval', (e, tnc_approval) => {
            if (tnc_approval == 1) {
                appStateService.hasToRedirectToTermsAndConditions = false;
                vm.redirect();
            }
        });


        $scope.$on('set_financial_assessment:success', (e, set_financial_assessment) => {
            if (appStateService.hasToRedirectToFinancialAssessment) {
                appStateService.hasToRedirectToFinancialAssessment = false;
                vm.redirect();
            }
        });

        $scope.$on('set-settings', (e, set_settings) => {
            if (appStateService.hasToRedirectToTaxInformation) {
                appStateService.hasToRedirectToTaxInformation = false;
                vm.redirect();
            }
        });

        // select country popup

        $scope.$on('get_settings', (e, get_settings) => {
            vm.countryCode = get_settings.country_code;
            if (vm.countryCode == null && appStateService.virtuality) {
                websocketService.sendRequestFor.residenceListSend();
            }
        });

        $scope.$on('residence_list', (e, residence_list) => {
            if (vm.countryCode == null && appStateService.virtuality) {
                vm.residenceList = residence_list;
                vm.selectCountry();
            }
        });

        vm.selectCountry = function() {
            $translate(['new-real-account.select_country', 'new-real-account.continue'])
                .then(function(translation) {
                    alertService.displaySelectResidence(
                        translation['new-real-account.select_country'],
                        'select-residence-popup',
                        $scope,
                        'js/share/templates/select-country/select-country.template.html', [{
                            text: translation['new-real-account.continue'],
                            type: 'button-positive',
                            onTap: function(e) {
                                if (vm.selectedCountry) {
                                    vm.setResidence();
                                } else {
                                    e.preventDefault();
                                }
                            }
                        }, ]);
                });
        }

        vm.setResidence = function() {
            var params = {
                "residence": vm.selectedCountry
            }
            websocketService.sendRequestFor.setAccountSettings(params);
            vm.updateResidence = true;
        }


    }
})();
