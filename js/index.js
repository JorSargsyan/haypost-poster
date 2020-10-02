var apiUrl = 'http://apidelivery.haypost.am:8091/';

var selectedRegion = {
    ID: 0
};
var selectedDistrict = {
    ID: 0
};
var selectedStreet = {
    ID: 0
};

var distance = 0;

var yandexMap;
var merchantAddress = '';
var merchantID = 0;
var overweightPrice = 0;
var selectedDeliveryType = {};
var selectedDistrictPostAddresses = [];
var nearPosts = [];
var branchIndex = '';
var cost = 0;
var paymentType = 1;
var orderID = '';
var callback;
var yandexKey = '';

var districtAutocompliteUrl = apiUrl + 'address/getaddresses?filter=District';
var streetAutocompliteUrl = apiUrl + 'address/getaddresses?filter=Street';

function include(filename, onload) {

    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.src = filename;
    script.type = 'text/javascript';
    script.onload = script.onreadystatechange = function () {
        if (script.readyState) {
            if (script.readyState === 'complete' || script.readyState === 'loaded') {
                script.onreadystatechange = null;
                onload();
            }
        }
        else {
            onload();
        }
    };
    head.appendChild(script);
}

include('https://code.jquery.com/jquery-3.5.1.min.js', function () {

    include('https://code.jquery.com/ui/1.12.1/jquery-ui.min.js', function () {
        $.get(apiUrl + 'widget/getsettings', {}, function (response) {
            overweightPrice = response.oversizedPrice;
            yandexKey = response.yandexKey;

            include('https://api-maps.yandex.ru/2.1/?apikey=' + yandexKey + '&lang=ru_RU', function () {
                $(document).ready(function () {
                    $("#poster-content").html(posterContent);

                    var clientKey = $("#poster-script").attr("key");
                    var bgColor = $("#poster-script").attr("bgcolor");
                    if (bgColor) {
                        $("#poster-content").css("background", bgColor);
                    }
                    orderID = $("#poster-script").attr("orderid");
                    callback = $("#poster-script").attr("callback");

                    //#region Init autocompletes
                    $('head').append('<link rel="stylesheet" href="css/widget.css" type="text/css" />');
                    $('head').append('<link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,300;1,400;1,600;1,700;1,800&display=swap" rel="stylesheet">');
                    if ($('meta[name="viewport"]').length === 0) {
                        $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
                    }

                    initAutocompletes();
                    $('.ui-helper-hidden-accessible').remove();
                    //#endregion

                    //#region Init Widget
                    $("input").attr("autocomplete", Math.random());
                    $.get(apiUrl + 'widget/getdeliverytypes', { clientKey: clientKey }, function (response) {
                        merchantAddress = response.merchantAddress;
                        //overweightPrice = response.overweightPrice;
                        merchantID = response.id;
                        $("#more-than-text").html("<span>More than 15 kg <br/>" + overweightPrice + " AMD</span><span class='info-cost'>!</span> ");
                        $.each(response.deliveryTypes, function (index, deliveryType) {
                            var radioContent = radioTemplate.replace("{radio-id}", "delivery-type-radio-" + index)
                                .replace("{radio-attr-name}", "delivery-type-radio")
                                .replace("{radio-value}", deliveryType.id)
                                .replace("{radio-express}", deliveryType.isExpress)
                                .replace("{readio-maxdistance}", deliveryType.maxDistance)
                                .replace("{radio-minprice}", deliveryType.minPrice)
                                .replace("{radio-fixedprice}", deliveryType.fixedPrice)
                                .replace("{radio-price}", deliveryType.price)
                                .replace("{radio-label}", "delivery-type-radio-" + index)
                                .replace("{radio-type-text}", deliveryType.name)
                                .replace("{radio-cost}", deliveryType.price + " AMD")
                                .replace("{radio-name}", deliveryType.name);

                            if (index == 0) {
                                radioContent = radioContent.replace("{radio-checked}", "checked")
                            } else {
                                radioContent = radioContent.replace("{radio-checked}", "")
                            }

                            $(".delivery-types").append(radioContent);
                        });
                    });

                    $(document).on("click", ".post-branch", function () {
                        $(".post-branch").removeClass("active");
                        $(this).addClass("active");
                        var id = $(this).attr("data-id");
                        branchIndex = $('.post-branch[data-id="' + id + '"] .branch-index').text();
                        var branchAddress = $('.post-branch[data-id="' + id + '"] .branch-address').text();
                        calculateDistance(merchantAddress, branchAddress)
                    })

                    $(document).on("click", "#payment-type-cache", function () {
                        paymentType = 1;
                        if (validateForm()) {
                            manageOrder();
                        }
                    })
                    $(document).on("click", "#payment-type-card", function () {
                        paymentType = 2;
                        if (validateForm()) {
                            manageOrder();
                        }
                    })
                    //#endregion

                    //#region Yandex map
                    ymaps.ready(init);
                    function init() {
                        yandexMap = new ymaps.Map("map", {
                            center: [40.17788613850269, 44.5128587479307],
                            zoom: 13
                        });
                    }
                    //#endregion

                    //#region Events
                    $(document).on('change', '.price-checking', function () {
                        priceChecking();
                    });
                    //#endregion
                });
            })
        });
    });
});

function calculateCost() {

    var isOversized = $("#more-than").prop("checked");

    distance = Math.ceil(distance * 2) / 2

    if (selectedDeliveryType.MaxDistance == "null") {
        cost = parseFloat(selectedDeliveryType.Price) * distance;
    }
    else {
        if (distance < parseFloat(selectedDeliveryType.MaxDistance)) {
            cost = parseFloat(selectedDeliveryType.MinPrice);
        } else {
            cost = parseFloat(selectedDeliveryType.Price) * distance;
        }
    }

    if (isOversized) {
        cost += overweightPrice;
    }
    $("#shiping-cost").text("Shiping cost: " + cost + " AMD");
}


function calculateDistanceWithoutRegion() {
    var orderAddress = $("#ac-address-district").val() + ", " + $("#ac-address-street").val() + " " + $("#address-building").val() + " " + $("#address-apartment").val();
    calculateDistance(merchantAddress, orderAddress.replace("ՆՐԲ.", "").replace("ՓԿՂ.", ""), true);
}

function calculateDistance(start, end, withoutRegion) {
    ymaps.route([
        start,
        {
            point: end,
            type: 'viaPoint'
        },
    ]).then(function (route) {
        if (yandexMap.geoObjects.getLength() > 0) {
            yandexMap.geoObjects.removeAll();
        }
        yandexMap.geoObjects.add(route);

        if (points && points.getLength() > 0) {
            points.removeAll();
        }

        var points = route.getWayPoints(),
            lastPoint = points.getLength() - 1;

        points.options.set('preset', 'islands#redStretchyIcon');

        points.get(0).properties.set('iconContent', 'Start');
        points.get(lastPoint).properties.set('iconContent', 'End');

        distance = parseFloat(route.getHumanLength());
        calculateCost();

    }, function (error) {
        if (!withoutRegion) {
            calculateDistanceWithoutRegion();
        }
    });

}

function calculatePostDistance(postAddresses, withoutRegion) {
    nearPosts = [];
    var orderAddress = (withoutRegion ? "" : $("#ac-address-region").val() + ", ") + $("#ac-address-district").val() + ", " + $("#ac-address-street").val() + " " + $("#address-building").val() + " " + $("#address-apartment").val();
    if (withoutRegion) {
        orderAddress = orderAddress.replace("ՆՐԲ.", "").replace("ՓԿՂ.", "");
    }
    $.each(postAddresses, function (index, address) {
        ymaps.route([
            orderAddress,
            {
                point: address.region + ", " + address.street,
                type: 'viaPoint'
            },
        ]).then(function (route) {
            if (parseFloat(route.getHumanLength()) <= 2) {

                var post = {
                    Distance: parseFloat(route.getHumanLength()),
                    Index: address.postIndex,
                    Street: address.region + ", " + address.street
                }
                var nearPostIsAdded = false;
                $.each(nearPosts, function (i, nPost) {
                    if (nPost.Index == post.Index) {
                        nearPostIsAdded = true;
                    }
                });

                if (!nearPostIsAdded) {
                    nearPosts.push(post);
                }
            }
            if (index === postAddresses.length - 1) {
                initPostAddresses();
            }
        }, function (error) {
            if (!withoutRegion) {
                calculatePostDistance(postAddresses, true);
            }
        });

    })
}

function initAutocompletes() {
    var $autocompletes = $('.poster-autocomplete');

    if ($autocompletes) {
        $.each($autocompletes, function (index, autocomplete) {
            var $autocomplete = $(autocomplete);
            var ajaxSource = $autocomplete.attr('data-ajaxSource');
            var autocompleteID = $autocomplete.attr('id');

            var formID = 'f-' + autocompleteID;

            var callbackMethod = $autocomplete.attr('data-callback');

            $autocomplete.autocomplete({
                autoFocus: true,
                source: ajaxSource,
                appendTo: "#" + formID,
                minLength: 3,
                messages: {
                    noResults: '',
                    results: function () { }
                },
                select: function (event, ui) {
                    event.preventDefault();
                    $autocomplete.val(ui.item.label);

                    if (callbackMethod) {
                        var callback = window[callbackMethod];

                        if (typeof callback === 'function') {
                            callback(ui.item.id, ui.item.value, ui.item.label);
                        }
                    }
                }
            }).data("ui-autocomplete")._renderItem = function (ul, item) {
                return $("<li></li>")
                    .addClass("filter-option")
                    .append("<label for=\"option-" + item.id + "\">" + item.label + "</label>")
                    .data("ui-autocomplete-item", item)
                    .appendTo(ul);
            };
        });
    }

    $(document).on('click', '.poster-autocomplete-dropdown-list, .poster-autocomplete', function () {
        var $filter = $(this).closest('.input-group').find('input.poster-autocomplete');
        $filter.autocomplete({ minLength: 0 });
        $filter.focus();
        $filter.data("uiAutocomplete").search('');
        $filter.autocomplete({ minLength: 3 });
    });
}

function addressRegionChange(index, value, text) {
    selectedDistrict = {
        ID: 0
    };
    selectedStreet = {
        ID: 0
    };
    $("#f-ac-address-district input").val("");
    $("#f-ac-address-street input").val("");

    $("#f-ac-address-district input").removeAttr("disabled");
    $("#f-ac-address-street input").attr("disabled", "disabled");

    selectedRegion.ID = index;
    selectedRegion.Name = text;
    $("#f-ac-address-district input").attr('data-ajaxSource', districtAutocompliteUrl + '&id=' + index);
    initAutocompletes();
}

function addressDistrictChange(index, value, text) {
    selectedStreet = {
        ID: 0
    };
    $("#f-ac-address-street input").val("");

    $("#f-ac-address-street input").removeAttr("disabled");

    selectedDistrict.ID = index;
    selectedDistrict.Name = text;
    $("#f-ac-address-street input").attr('data-ajaxSource', streetAutocompliteUrl + '&id=' + index);
    initAutocompletes();
}

function addressStreetChange(index, value, text) {
    selectedStreet.ID = index;
    selectedStreet.Name = text;
    priceChecking();
}

function priceChecking() {
    $(".post-addresses").hide();
    var formValid = true;
    var $radio = $("input[name='delivery-type-radio']:checked");
    selectedDeliveryType = {
        TypeID: $radio.val(),
        IsExpress: $radio.attr("isexpress"),
        Price: $radio.attr("price"),
        MaxDistance: $radio.attr("maxdistance"),
        MinPrice: $radio.attr("minprice"),
        FixedPrice: $radio.attr("fixedprice")
    };

    var isOversized = $("#more-than").prop("checked");

    if (selectedStreet.ID == 0 || !$("#address-building").val()) {
        formValid = false;
    }

    if (formValid && selectedDeliveryType.IsExpress == 'true') {
        var orderAddress = $("#ac-address-region").val() + ", " + $("#ac-address-district").val() + ", " + $("#ac-address-street").val() + " " + $("#address-building").val() + " " + $("#address-apartment").val();
        calculateDistance(merchantAddress, orderAddress);
    }
    else if (formValid) {
        $.get(apiUrl + 'widget/getdistrictpostaddress', { districtID: selectedDistrict.ID }, function (response) {
            selectedDistrictPostAddresses = response;
            calculatePostDistance(selectedDistrictPostAddresses);
        });
        cost = 0;
        $("#shiping-cost").text("");
    }
}

function getPostAddresses() {
    var searchControl = new ymaps.control.SearchControl({
        options: {
            provider: 'yandex#search'
        }
    });

    yandexMap.controls.add(searchControl);

    searchControl.search('Hay Post');
}

function initPostAddresses() {
    $(".post-addresses").show();
    $(".post-addresses-body").html("");
    $.each(nearPosts, function (index, nearPost) {
        $(".post-addresses-body").append(branchTemplate.replace("{data-id}", index).replace("{branch-index}", nearPost.Index).replace("{branch-address}", nearPost.Street).replace("{branch-distance}", nearPost.Distance));
    })
    $(".post-branch")[0].click();
}

function manageOrder() {

    if (validateForm()) {

    }
    var model = {
        Name: $("#receiver-name").val(),
        SurName: $("#receiver-sur-name").val(),
        Email: $("#receiver-email").val(),
        Mobile: $("#receiver-mobile").val(),
        PaymentType: paymentType,
        Comments: $("#address-comments").val(),
        Building: $("#address-building").val(),
        Apartment: $("#address-apartment").val(),
        Amount: cost,
        DeliveryTypeID: selectedDeliveryType.TypeID,
        StreetID: selectedStreet.ID,
        MerchantID: merchantID,
        Oversized: $("#more-than").prop("checked"),
        OrderID: orderID,
        RecipientPost: $(".post-branch.active .branch-index").text()
    };

    $.ajax(apiUrl + 'widget/manageorder', {
        type: 'POST',
        data: { model: model },
        success: function (response) {
            if (response.isSuccess) {
                if (callback) {
                    window[callback](response.order);
                }
            }
            else {
                $('#error-message').html('Error: ' + response.message);
            }
        },
        error: function (jqXhr, textStatus, errorMessage) {
            $('#error-message').html('Error: ' + errorMessage);
        }
    });
};

function validateForm() {
    var valid = true;
    if (!$("#frm-order")[0].checkValidity()) {
        valid = false;
        $("#frm-order")[0].reportValidity();
    }
    return valid;
}

var branchTemplate = '<tr class="post-branch cursor-pointer" data-id="{data-id}"><td class="branch-index">{branch-index}</td><td class="branch-address">{branch-address}</td><td>{branch-distance}</td></tr>'

var radioTemplate = '<div><input class="poster-radio price-checking cursor-pointer"' +
    '       type="radio"' +
    '       id="{radio-id}"' +
    '       {radio-checked}' +
    '       name="{radio-attr-name}"' +
    '       value="{radio-value}"' +
    '       radionName="{radio-type-text}"' +
    '       isExpress="{radio-express}"' +
    '       maxDistance="{readio-maxdistance}"' +
    '       minPrice="{radio-minprice}"' +
    '       fixedPrice="{radio-fixedprice}"' +
    '       price="{radio-price}"' +
    '       >' +
    '       <label class="cursor-pointer" for="{radio-label}"><span>' +
    '           {radio-name}' +
    '           </br>{radio-cost}</span>' +
    '           <span class="info-cost">!</span>' +
    '       </label>' +
    '</div>';

var posterContent = `<header></header>
<form id="frm-order">   
        <div class="shipping-details">   
            <h2>   
                Shipping Details
            </h2>   
            <br />   
            <hr />   
            <div class="delivery-types-container">   
                <div class="delivery-types">   
  
                </div>   
                <div class="more-than"><div> 
                    <input class="price-checking cursor-pointer" type="checkbox" id="more-than" name="more-than">   
                    <label id="more-than-text" class="cursor-pointer" for="more-than"></label>   
                    </div>   
                </div>   
            </div>   
            <div class="tabs-container">
                <div class="tab-item tab-1 active">
                    //first tab
                    <div class="receiver-data">   
                        <div class="form-group receiver-name">   
                            <div id="area-receiver-name">   
                                <div class="input-group">   
                                    <input type="text" class="form-control" id="receiver-name" placeholder="Name" required>   
                                </div>   
                            </div>   
                        </div>   
        
                        <div class="form-group receiver-sur-name">   
                            <div id="area-receiver-sur-name">   
                                <div class="input-group">   
                                    <input type="text" class="form-control" placeholder="Sur Name" id="receiver-sur-name" required>   
                                </div>   
                            </div>   
                        </div>   
        
                        <div class="form-group receiver-email">   
                            <div id="area-receiver-email">   
                                <div class="input-group">   
                                    <input type="email" class="form-control" id="receiver-email" placeholder="Email" pattern="[a-z0-9._%-]@[a-z0-9.-]\.[a-z]{2,4}$")" required>   
                                </div>   
                            </div>   
                        </div>   
        
                        <div class="form-group receiver-mobile">   
                            <div id="area-receiver-mobile">   
                                <div class="input-group">   
                                    <input type="number" class="form-control" placeholder="Mobile" id="receiver-mobile" required>   
                                </div>   
                            </div>   
                        </div>   
                    </div> 
                </div> 
                <div class="tab-item tab-2">
                //second tab
                <div class="receiver-address">   
    
                    <div class="form-group region">   
                        <div id="f-ac-address-region">   
                            <div class="input-group">   
                                <input placeholder="Region" class="poster-autocomplete form-control"   
                                    data-ajaxSource="  apiUrl  address/getaddresses?filter=Region"   
                                    data-callback="addressRegionChange"   
                                    id="ac-address-region" required>   
    
                            </div>   
                        </div>   
                    </div>   
    
                    <div class="form-group district">   
                        <div id="f-ac-address-district">   
                            <div class="input-group">   
                                <input placeholder="District"   
                                    class="poster-autocomplete form-control"   
                                    data-callback="addressDistrictChange" disabled  
                                    id="ac-address-district" required>   
                            </div>   
                        </div>   
                    </div>   
    
                    <div class="form-group street">   
                        <div id="f-ac-address-street">   
                            <div class="input-group">   
                                <input class="poster-autocomplete form-control price-checking"   
                                    placeholder="Street"   
                                    data-callback="addressStreetChange" disabled  
                                    id="ac-address-street" required>   
                            </div>   
                        </div>   
                    </div>   
    
                    <div class="form-group building">   
                        <div id="area-address-building">   
                            <div class="input-group">   
                                <input type="text" placeholder="Building" class="form-control price-checking" id="address-building" required>   
                            </div>   
                        </div>   
                    </div>   
    
                    <div class="form-group apartment">   
                        <div id="area-address-apartment">   
                            <div class="input-group">   
                                <input type="text" placeholder="Apartment" class="form-control price-checking" id="address-apartment">   
                            </div>   
                        </div>   
                    </div>   
                </div> 
                <div style="padding: 20px 4px; overflow:hidden">   
                    <div id="map" style=" width: 100%; height: 300px; "></div>   
                </div>   
                </div>
                <div class="tab-item tab3">
                //third tab

                    <div class="shipping-cost">   
                    <p id="shiping-cost"></p>   
                    <p id="error-message" style="color: red;"></p>   
        
                    <div class="form-group apartment">   
                        <input type="button" id="payment-type-card" value="Checkout with Card">   
                        <input type="button" id="payment-type-cache" value="Checkout cash on delivery">   
                    </div>   
                </div>
                </div>
            </div>   

            <div style="padding:10px 4px">   
                <table class="post-addresses" style="display:none; width:100%" cellspacing="0">   
                    <caption class="f-w-600 t-left p-b-10">Please select the branch to be delivered.</caption>   
                    <thead style="background-color:#bdbdbd">   
                        <tr>   
                            <th>Branch index</th>   
                            <th>Branch address</th>   
                            <th>Distance</th>   
                        </tr>   
                    </thead>   
                    <tbody class="post-addresses-body">   
                    </tbody>   
                </table>   
            </div>   
        </div>   

        <div class="shipping-cost">   
            <p id="shiping-cost"></p>   
            <p id="error-message" style="color: red;"></p>   

            <div class="form-group apartment">   
                <input type="button" id="payment-type-card" value="Checkout with Card">   
                <input type="button" id="payment-type-cache" value="Checkout cash on delivery">   
            </div>   
        </div>
        </form>
        <footer></footer>`;
