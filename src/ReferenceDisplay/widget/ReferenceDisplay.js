/*global logger*/
/*
    ReferenceSetDisplay
    ========================

    @file      : ReferenceDisplay.js
    @version   : 1.0.0
    @author    : Iain Lindsay
    @date      : 2018-06-19
    @copyright : AuraQ Limited 2018
    @license   : Apache V2

    Documentation
    ========================
    Alternative way to render a reference
*/

define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "mxui/dom",
    "dojo/dom",
    "dojo/dom-prop",
    "dojo/dom-geometry",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text",
    "dojo/html",
    "dojo/on",
    "dojo/_base/event",

    "dojo/text!ReferenceDisplay/widget/template/ReferenceDisplay.html"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, dojoProp, dojoGeometry, dojoClass, dojoStyle, dojoConstruct, dojoArray, dojoLang, dojoText, dojoHtml, dojoOn, dojoEvent, widgetTemplate) {
    "use strict";

    return declare("ReferenceDisplay.widget.ReferenceDisplay", [ _WidgetBase, _TemplatedMixin ], {

        templateString: widgetTemplate,


        widgetBase: null,

        // Internal variables.
        _handles: null,
        _contextObj: null,
        _targetReference : null,
        _sortParams : [],

        constructor: function () {
            this._handles = [];
        },

        postCreate: function () {
            logger.debug(this.id + ".postCreate");
            this._targetReference = this.contextObjectAssociation.split('/')[0];

            // issues with the sort parameters being persisted between widget instances mean we set the sort array to empty.
            this._sortParams = [];
            // create our sort order array
            for(var i=0;i< this._sortContainer.length;i++) {
                var item = this._sortContainer[i];
                this._sortParams.push([item.sortAttribute, item.sortOrder]); 
            }
        },

        update: function (obj, callback) {
            logger.debug(this.id + ".update");

            if( obj === null ){
                this._executeCallback(callback,"update");
                return;
            } else {
                this._contextObj = obj;
                this._resetSubscriptions();
                this._updateRendering(callback);
            }
        },

        resize: function (box) {
            logger.debug(this.id + ".resize");
        },

        uninitialize: function () {
            logger.debug(this.id + ".uninitialize");
        },

        _updateRendering: function (callback) {
            logger.debug(this.id + "._updateRendering");
            var self = this;
            if(this.rdListContainer){
            // load the data
            var xpath = '//' + this.targetEntity + 
                "[" + this.contextObjectAssociation + "[id='" + this._contextObj.getGuid() + "']]" +
                this.dataConstraint.replace(/\[\%CurrentObject\%\]/gi, this._contextObj.getGuid());

                mx.data.get({
                    xpath: xpath,
                    filter: {
                        sort: this._sortParams,
                        offset: 0,
                        amount: 0
                    },
                    callback: function(objs){
                        if(self.rdListContainer){
                            var dataArray = objs.map(function(o){
                                var data = {};
                                data.guid = o.getGuid();
                                data.caption = o.get(self.displayAttribute);                                

                                return data;
                            });
                            dojoConstruct.empty(self.rdListContainer);

                            for(var i = 0; i< dataArray.length; i++){
                                var obj = dataArray[i];
                                var caption = obj.caption;
                                var itemContent = dojoConstruct.toDom("<span class='rdItemContent'>" + caption + "</span>");
                                if(self.enableClickToRemove){
                                    var itemAnchor = self._getAnchorForItem(obj);
                                    dojoConstruct.place(itemContent,itemAnchor);
                                    itemContent = itemAnchor;
                                }
                                var item = dojoConstruct.toDom("<li class='rdItem'></li>");
                                dojoConstruct.place(itemContent,item);

                                dojoConstruct.place(item, self.rdListContainer,"last");
                            }

                            self._executeCallback(callback,"_updateRendering");
                        }
                    }
                });
            }else{
                this._executeCallback(callback,"_updateRendering");
            }
        },

        _getAnchorForItem : function(obj) {
            var itemAnchor = dojoConstruct.toDom("<a></a>");
            var guid = obj.guid;
            var self = this;
            dojoOn(itemAnchor, "click",function(objGuid){
                var innerSelf = self;
                return function(evt){
                    evt.preventDefault();

                    mx.data.remove(
                    {   
                        guid: objGuid,
                        callback: function(){
                            innerSelf._updateRendering();

                            if( innerSelf.onClickMicroflow ) {
                                innerSelf._execMf(innerSelf.onClickMicroflow, innerSelf._contextObj.getGuid());
                            }
                        }
                    });                    
                }
            }(guid));

            return itemAnchor;
        },

        // Reset subscriptions.
        _resetSubscriptions: function() {
            logger.debug(this.id + "._resetSubscriptions");
            // Release handles on previous object, if any.
            if (this._handles) {
                dojoArray.forEach(this._handles, function (handle) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }

            // When a mendix object exists create subscriptions.
            if (this._contextObj) {
                var objectHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function(guid) {                                              
                        this._updateRendering();
                    })
                });

                var referenceHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this._targetReference,
                    callback: dojoLang.hitch(this, function(guid, attr, attrValue) {
                        this._updateRendering();
                    })
                });

                this._handles = [ objectHandle, referenceHandle ];
            }
        },

        // Shorthand for running a microflow
        _execMf: function (mf, guid, cb) {
            logger.debug(this.id + "._execMf");
            if (mf && guid) {
                mx.ui.action(mf, {
                    params: {
                        applyto: "selection",
                        guids: [guid]
                    },
                    callback: dojoLang.hitch(this, function (objs) {
                        if (cb && typeof cb === "function") {
                            cb(objs);
                        }
                    }),
                    error: function (error) {
                        console.debug(error.description);
                    }
                }, this);
            }
        },

        // Shorthand for executing a callback, adds logging to your inspector
        _executeCallback: function (cb, from) {
            logger.debug(this.id + "._executeCallback" + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        }
    });
});

require(["ReferenceDisplay/widget/ReferenceDisplay"]);
