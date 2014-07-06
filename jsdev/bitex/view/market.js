goog.provide('bitex.view.MarketView');
goog.require('bitex.view.View');
goog.require('bitex.ui.TradeHistory');
goog.require('bitex.ui.MarketViewTable');

goog.require('bitex.templates');

/**
 * @param {*} app
 * @param {goog.dom.DomHelper=} opt_domHelper
 * @constructor
 * @extends {bitex.view.View}
 */
bitex.view.MarketView = function(app, opt_domHelper) {
  bitex.view.View.call(this, app, opt_domHelper);

  this.market_data_subscription_id_ = null;
  this.market_data_subscription_symbol_ = null;
};
goog.inherits(bitex.view.MarketView, bitex.view.View);


/**
 * @type {number}
 */
bitex.view.MarketView.prototype.market_data_subscription_id_;

/**
 * @type {Array.<string>}
 */
bitex.view.MarketView.prototype.market_data_subscription_symbol_;

/**
 * @type {bitex.ui.TradeHistory}
 */
bitex.view.MarketView.prototype.last_trades_table_;

/**
 * @type {bitex.ui.MarketViewTable}
 */
bitex.view.MarketView.prototype.market_view_table_;


bitex.view.MarketView.prototype.enterView = function() {
  this.recreateComponents_();
};

bitex.view.MarketView.prototype.exitView = function() {
  this.destroyComponents_();
};

bitex.view.MarketView.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');
};

bitex.view.MarketView.prototype.recreateComponents_ = function() {
  var handler = this.getHandler();
  var model = this.getApplication().getModel();
  var conn = this.getApplication().getBitexConnection() ;

  this.destroyComponents_();

  this.market_data_subscription_id_ = parseInt( 1e7 * Math.random() , 10 );

  this.market_data_subscription_symbol_ =  [];
  goog.array.forEach(app.getModel().get('SecurityList')['Instruments'], function(instrument_info) {
    this.market_data_subscription_symbol_.push(instrument_info['Symbol'] );
  }, this);

  this.market_view_table_ = new bitex.ui.MarketViewTable();
  this.market_view_table_.setModel({id:'market_view', instruments: app.getModel().get('SecurityList')['Instruments']});
  this.market_view_table_.render(goog.dom.getElement('id_market_view_table'));
  app.getModel().updateDom();

  var el = goog.dom.getElement('id_trade_list_table');

  this.last_trades_table_ = new bitex.ui.TradeHistory();

  handler.listen(this.last_trades_table_,
                 bitex.ui.DataGrid.EventType.REQUEST_DATA,
                 this.onTradeHistoryTableRequestData_);

  handler.listen(this.getApplication().getBitexConnection(),
                 bitex.api.BitEx.EventType.TRADE_HISTORY_RESPONSE + '.' + this.market_data_subscription_id_,
                 this.onTradeHistoryReponse_);

  handler.listen( conn , bitex.api.BitEx.EventType.TRADING_SESSION_STATUS + '.' + this.market_data_subscription_id_, this.onBitexTradingSessionStatus_ );
  handler.listen( conn , bitex.api.BitEx.EventType.ORDER_BOOK_NEW_ORDER + '.' + this.market_data_subscription_id_, this.onBitexOrderBookNewOrder_ );
  handler.listen( conn , bitex.api.BitEx.EventType.TRADE + '.' + this.market_data_subscription_id_, this.onBitexTrade_ );

  this.last_trades_table_.decorate(el);

  this.dispatchEvent(bitex.view.View.EventType.MARKET_DATA_SUBSCRIBE);
  this.dispatchEvent(bitex.view.View.EventType.SECURITY_STATUS_SUBSCRIBE);
};

bitex.view.MarketView.prototype.destroyComponents_ = function( ) {
  var handler = this.getHandler();

  if (goog.isDefAndNotNull(this.market_view_table_) ) {
    this.market_view_table_.dispose();
  }

  if (goog.isDefAndNotNull(this.last_trades_table_) ) {
    handler.unlisten(this.last_trades_table_,
                     bitex.ui.DataGrid.EventType.REQUEST_DATA,
                     this.onTradeHistoryTableRequestData_);

    handler.unlisten(this.getApplication().getBitexConnection(),
                     bitex.api.BitEx.EventType.TRADE_HISTORY_RESPONSE + '.' + this.market_data_subscription_id_,
                     this.onTradeHistoryReponse_);

    handler.unlisten(this.last_trades_table_.getElement(),
                     goog.events.EventType.CLICK,
                     this.onTradeHistoryTableClick_);

    this.last_trades_table_.dispose();
  }

  if (goog.isDefAndNotNull(this.market_data_subscription_id_)) {
    var conn = this.getApplication().getBitexConnection() ;

    handler.unlisten( conn , bitex.api.BitEx.EventType.TRADING_SESSION_STATUS + '.' + this.market_data_subscription_id_, this.onBitexTradingSessionStatus_ );
    handler.unlisten( conn , bitex.api.BitEx.EventType.ORDER_BOOK_NEW_ORDER + '.' + this.market_data_subscription_id_, this.onBitexOrderBookNewOrder_ );
    handler.unlisten( conn , bitex.api.BitEx.EventType.TRADE + '.' + this.market_data_subscription_id_, this.onBitexTrade_ );

    this.dispatchEvent(bitex.view.View.EventType.MARKET_DATA_UNSUBSCRIBE);
    this.dispatchEvent(bitex.view.View.EventType.SECURITY_STATUS_UNSUBSCRIBE);

  }


  this.market_view_table_ = null;
  this.last_trades_table_ = null;
  this.market_data_subscription_id_ = null;
  this.market_data_subscription_symbol_ = null;
};

/**
 * @param {goog.events.Event} e
 */
bitex.view.MarketView.prototype.onTradeHistoryTableRequestData_ = function(e) {
  var page = e.options['Page'];
  var limit = e.options['Limit'];
  var filter = e.options['Filter'];
  
  var conn = this.getApplication().getBitexConnection();
  conn.requestTradeHistory(this.market_data_subscription_id_, page, limit, undefined, filter );
};


/**
 * @param {goog.events.Event} e
 */
bitex.view.MarketView.prototype.onBitexTrade_ = function(e) {
  if (!goog.isDefAndNotNull(this.last_trades_table_) ) {
    return;
  }
  var msg = e.data;
  var record = []; 

  record["TradeID"] = msg["TradeID"];
  record["Market"] = msg["Symbol"];
  record["Size"] = msg['MDEntrySize'];
  record["Price"] = msg['MDEntryPx'];
  record["Side"] = msg['Side'];
  record["Buyer"] = msg['MDEntryBuyer'];
  record["Seller"] = msg['MDEntrySeller'];
  record["Created"] = msg['MDEntryDate'] + " " + msg['MDEntryTime'];

  this.last_trades_table_.insertOrUpdateRecord(record, 0);
};


/**
 * @param {goog.events.Event} e
 */
bitex.view.MarketView.prototype.onTradeHistoryReponse_ = function(e) {
  if (!goog.isDefAndNotNull(this.last_trades_table_) ) {
    return
  }

  var msg = e.data;
  this.last_trades_table_.setResultSet( msg['TradeHistoryGrp'], msg['Columns'] );
};


bitex.view.MarketView.prototype.onBitexOrderBookNewOrder_ = function(e) {
    var msg = e.data;

    var symbol = msg['Symbol'];
    var index = msg['MDEntryPositionNo'] - 1;
    var price =  msg['MDEntryPx']/1e8;
    var qty = msg['MDEntrySize']/1e8;
    var username = msg['Username'];
    var broker = msg['Broker'];
    var orderId =  msg['OrderID'];
    var side = msg['MDEntryType'];
    var currency = symbol.substr(3,3);

    if (side == '0') {
      if (index === 0) {
        var bid_key = 'best_bid_' +  currency.toLowerCase();
        this.getApplication().getModel().set('formatted_' + bid_key, this.getApplication().formatCurrency(price, currency));
      }
    } else if (side == '1') {
      if (index === 0) {
        var offer_key = 'best_offer_' +  currency.toLowerCase();
        this.getApplication().getModel().set('formatted_' + offer_key, this.getApplication().formatCurrency(price, currency));
      }
    }
};

bitex.view.MarketView.prototype.onBitexTradingSessionStatus_ = function(e) {
    try {
      //  {"BRL": 52800000000, "MDEntryType": "4", "BTC": 66000000}
      var msg = e.data;
      delete msg['MDEntryType'];
      delete msg['MDReqID'];

      var app = this.getApplication();
      goog.object.forEach( msg, function(volume, currency) {
        volume = volume / 1e8;

        var volume_key = 'volume_' +  currency.toLowerCase();
        app.model_.set( volume_key , volume );
        app.model_.set('formatted_' + volume_key, app.formatCurrency(volume, currency));
      });
    } catch(str) {}
};

/**
 * @param {goog.events.Event} e
 */
bitex.view.MarketView.prototype.onTradeHistoryTableClick_ = function(e) {
  var element = e.target;
  if (element.tagName  === goog.dom.TagName.I ) {
    element = goog.dom.getParentElement(element);
  }

  var data_action = element.getAttribute('data-action');
  if (goog.isDefAndNotNull(data_action)) {
    e.preventDefault();
    e.stopPropagation();

    this.action_ = data_action;
    this.data_ = goog.json.parse(element.getAttribute('data-row'));

    // todo
  }
};

/**
 * @return {number}
 */
bitex.view.MarketView.prototype.getMDSubscriptionId = function(){
  return this.market_data_subscription_id_;
};

/**
 * @return {Array.<string>}
 */
bitex.view.MarketView.prototype.getMDInstruments = function(){
  return this.market_data_subscription_symbol_;
};

/**
 * @return {number}
 */
bitex.view.MarketView.prototype.getMDMarketDepth = function(){
  return 1;
};

/**
 * @return {Array.<string>}
 */
bitex.view.MarketView.prototype.getMDEntries = function(){
  return ['2'];
};

/**
 * @return {Array.<string>}
 */
bitex.view.MarketView.prototype.getSecurities = function(){
  return this.market_data_subscription_symbol_;
};

/**
 * @return {number}
 */
bitex.view.MarketView.prototype.getSecSubscriptionId = function(){
  return this.market_data_subscription_id_;
};


/**
 * @override
 * @protected
 */
bitex.view.MarketView.prototype.exitDocument = function() {
  goog.base(this, 'exitDocument');
  this.destroyComponents_();
};
