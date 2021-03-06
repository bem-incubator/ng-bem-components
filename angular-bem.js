/*eslint-disable max-len */
var deps = ['jquery', 'i-bem__dom', 'BEMHTML'],
    events = 'click dblclick mousedown mouseup mouseover mouseout mousemove mouseenter mouseleave keydown keyup keypress submit focus blur copy cut paste'.split(' ');
/*eslint-enable max-len */

modules.isDefined('BEMTREE') &&
    deps.push('BEMTREE');

modules.define('angular-bem', deps,
    function(provide, $, BEMDOM, BEMHTML, BEMTREE) {

        angular.module('angular-bem', [])
            .value('bemdom', BEMDOM)
            .value('bemhtml', BEMHTML)
            .value('bemtree', BEMTREE)
            .factory('ngbem', ngbemFactory)
            .directive('ngBem', ngBemDirective)
            .directive('bem', bemDirective);

        function ngbemFactory(bemhtml, bemtree, $q, $log) {

            return render;

            function processBemtree(bemjson) {
                return bemtree.apply(bemjson);
            }

            function processBemhtml(bemjson) {
                return bemhtml.apply(bemjson);
            }

            function render(bemjson, useBemtree) {
                var deferred = $q.defer(),
                    promise;

                if(useBemtree) {
                    angular.isUndefined(bemtree)?
                        $log.error('BEMTREE is not defined') && deferred.reject() :
                        processBemtree(bemjson).then(function(result){
                            deferred.resolve(result);
                        });
                } else {
                    deferred.resolve(bemjson);
                }

                promise = deferred.promise
                    .then(function(result){
                        return processBemhtml(result);
                    });

                return promise;
            }
        }

        function ngBemDirective(ngbem, bemdom, $compile) {
            return {
                restrict : 'AE',
                link : function(scope, element, attrs) {
                    var bemjsonExpression = attrs.bemjson || element.text(),
                        useBemtree = !angular.isUndefined(attrs.bemtree);

                    scope.$watch('[' + attrs.observe + ']', function(){
                        // copy prevents unnecessary call of watch function
                        var bemjson = angular.copy(scope.$eval(bemjsonExpression));

                        ngbem(bemjson, useBemtree).then(function(html){
                            bemdom.update(element, html);
                            $compile(element.children())(scope);
                        });

                    }, true);

                    scope.$on('$destroy', function(){
                        bemdom.destruct(element.children());
                    });

                }
            };
        }

        function bemController($scope, $attrs, $element) {
            this.bem = $scope.$eval($attrs.bem);

            angular.forEach(this.bem, function(v, blockName) {
                var block;

                Object.defineProperty(this.bem, blockName, { get : function(){
                    return (block = block || $($element).bem(blockName));
                } });
            }, this);

            $scope.$bem = this.bem;
        }

        function bemDirective($parse) {
            return {
                restrict : 'A',
                require : ['bem', '?ngModel'],
                controller : bemController,
                link : function(scope, element, attrs, ctrls) {
                    var iBem = ctrls[0],
                        ngModel = ctrls[1];

                    angular.forEach(attrs.$attr, function(attrOrig, attrNormal){
                        var modName = attrOrig.split('bem-mod-')[1],
                            eventName = attrOrig.split('bem-event-')[1],
                            modEvent = attrOrig.split('bem-modevent-')[1],
                            expression = attrs[attrNormal],
                            bindExpression,
                            event;

                        if(modName) {
                            bindExpression = expression.startsWith('bind:') &&
                                !!(expression = expression.substring(5));

                            var modExpressionSetter = $parse(expression).assign;

                            scope.$watch(expression, function(newVal, oldVal){
                                newVal === undefined && (newVal = false);

                                angular.forEach(iBem.bem, function(block) {
                                    block.setMod(modName, newVal);
                                });
                            });

                            if(bindExpression && modExpressionSetter) {
                                angular.forEach(iBem.bem, function(block) {
                                    block.on({ modName : modName, modVal : '*' }, function(event, data){
                                        data.modVal === '' && (data.modVal = false);

                                        scope.$evalAsync(function(){
                                            modExpressionSetter(scope, data.modVal);
                                        });
                                    });
                                });
                            }
                        }

                        event = modEvent? {
                            modName : modEvent,
                            modVal : '*'
                        } : eventName;

                        if(event) {
                            angular.forEach(iBem.bem, function(block) {
                                block.on(event, function(event, data){
                                    scope.$evalAsync(expression, {
                                        $bemEvent : {
                                            event : event,
                                            target : event.target,
                                            data : data
                                        }
                                    });
                                });
                            });
                        }
                    });

                    angular.forEach(events, function(eventName){
                        var attrName = attrs.$normalize('ng-' + eventName);

                        if(attrs[attrName]) {
                            angular.forEach(iBem.bem, function(block) {
                                block.elem('control').not(block.domElem).on(eventName, function(){
                                    block.domElem.trigger(eventName);
                                });
                            });
                        }
                    });

                    if(!ngModel) return;

                    angular.forEach(iBem.bem, function(v, blockName) {
                        iBem.bem[blockName].on('change', function(e, data) {
                            if(data && data.source === 'ng-model') {
                                scope.$evalAsync(setModelValue.bind(iBem.bem[blockName]));
                            } else {
                                scope.$evalAsync(setViewValue.bind(iBem.bem[blockName]));
                            }
                        });

                        setModelValue.bind(iBem.bem[blockName])();
                    });

                    ngModel.$render = function() {
                        var value = angular.isUndefined(ngModel.$viewValue)? '' : ngModel.$viewValue;
                        angular.forEach(iBem.bem, function(v, blockName) {
                            if(iBem.bem[blockName].setVal) {
                                iBem.bem[blockName].setVal(value, { source : 'ng-model' });
                            }
                        });
                    };

                    function setViewValue() {
                        ngModel.$setViewValue(this.getVal());
                    }

                    function setModelValue() {
                        // prevents calling of ng-change listeners
                        ngModel.$modelValue = this.getVal();
                    }
                }
            };
        }

        provide(angular.module('angular-bem'));
    }
);
