var width = 750,
    height = 500,
    radius = Math.min(width, height) / 2;

var leadersScale = d3.scale.linear().range([10, 60]);
var rScale = d3.scale.linear().domain([0,4]).range([0,radius]);
var myScale = [0, rScale(1.5), rScale(3.5), rScale(3.75), rScale(4)];
var fill = d3.scale.category20();

var sunburst = d3.select("#top-scores").append("svg")
    .attr("width", width)
    .attr("height", height * 1.04)
    .append("g")
    .attr("transform", "translate("+ width / 2 + "," + height * .52 + ")");

var infoBox = d3.select("#top-scores svg")
    .append("g")
    .attr("transform", "translate("+((width /2) - rScale(1.1))+","+((height /2) -rScale(.2))+")")
    .append("text")
    .style("font-size", "12px");

var partition = d3.layout.partition()
    .sort(null)
    .size([2 * Math.PI, radius * radius])
    .value((d) => 1)
    .children(function(d) {
        console.log(d);
        return d.children ? d.children : 
        d.entries ? d.entries() : 
        d.text? null : 
        d.value.length ? d.value : d.value.entries()
    });

var arc = d3.svg.arc()
    .startAngle((d) => d.x)
    .endAngle((d) => d.x + d.dx)
    .innerRadius((d) => myScale[d.depth])
    .outerRadius((d) => myScale[d.depth +1]);

d3.tsv("stats.tsv", function(data) {
    var leaders = data
        .filter((d) => +d.G > 0 )
        .map((d) => ({text : d.Name, size : +d.G, goals: +d.G, team: d.Team, pos: d.Pos} ))
        .sort((a, b) => d3.descending(a.size, b.size))
        .slice(0, 100);

    var leadersByTeamPos = d3.nest()
        .key((d) => d.team)
        .key((d) => d.pos)
        .map(leaders, d3.map);

    leadersScale.domain([
        d3.min(leaders, (d) => d.size),
        d3.max(leaders, (d) => d.size)
    ]);

    d3.layout.cloud()
        .size([width, height])
        .words(leaders)
        .padding(0)
        //.rotate(function() { return ~~(Math.random() * 2) * 90; })
        .font("Impact")
        .fontSize((d) => leadersScale(d.size))
        .on("end", drawcloud)
        .start();
    
    drawSunburst(leadersByTeamPos);
});

function drawcloud(words) {
d3.select("#word-cloud").append("svg") 
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + (width /2)+","+ (height /2) +")")
    .selectAll("text")
    .data(words)
    .enter().append("text")
    .style("font-size", (d) => d.size + "px")
    .style("font-family", "Impact")
    .style("fill", (d, i) => fill(i))
    .attr("text-anchor", "middle")
    .attr("transform", (d) => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
    .text((d) => d.text);
}

function drawSunburst(data){
    var g = sunburst.datum(data).selectAll("g")
        .data(partition.nodes)
        .enter().append("g")
        .attr("display", (d) => d.depth ? null : "none") //hide inner ring
    
    var path = g.append("path")
        .attr("d", arc)
        .style("stroke", "#fff")
        .style("fill", (d) => fill(d.children ? d.key : d.text))
        .style("fill-rule", "evenodd")
        .on("mouseover", (d) => writeInfo(d))
        .on("click", (d) => writeInfo(d))
        .each(stash);

    var text = g.filter((d) => d.depth < 3)
        .append("text")
        .style("fill","white")
        .style("font-size", "10px");

    text.each(function(d) {
        var radius = myScale[d.depth];
        var angle = calcAngle(d.x, d.dx);
        var margin = (d.depth == 2)? 8:5;
        margin *= (angle > 90)? -1:1;
        var anchor = (d.depth == 2)? "middle" :(angle > 90)? "end":"start";
        d3.select(this)
            .attr("dx", margin)
            .attr("dy", ".38em") //Vertical alignment
            .attr("transform", "rotate(" + angle + ")translate(" + radius + ")rotate(" + (angle > 90 ? -180 : 0) +")" )
            .attr("text-anchor", anchor)
            .text(d.key);
    });

    d3.selectAll("input").on("change", function change() {
        var value = this.value === "count"
            ? (d) => 1
            : (d) => d.goals
        path
            .data(partition.value(value).nodes)
            .transition()
            .duration(1500)
            .attrTween("d", arcTween);

        text.each(function(d) {
            var radius = myScale[d.depth];
            var angle = calcAngle(d.x, d.dx);
            var margin = (d.depth == 2)? 8:5;
            margin *= (angle > 90)? -1:1;
            var selection = d3.select(this);
            var anchor = selection.attr("text-anchor");
            selection
                .attr("dx", margin)
                .attr("transform", "rotate(" + angle + ")translate(" + 
                    ((anchor == "start" && angle > 90)
                    ? (radius + this.getBBox().width)
                    : radius) +
                    ")rotate(" + (angle > 90 ? -180 : 0) +")" );
        });
    });
}

function stash(d) {
    d.x0 = d.x;
    d.dx0 = d.dx;
}

function arcTween(a) {
    var i = d3.interpolate({x: a.x0, dx: a.dx0}, a);
    return function(t) {
        var b = i(t);
        a.x0 = b.x;
        a.dx0 = b.dx;
        return arc(b);
    }
}

function writeInfo(d) {
    var team = pos = name2 = goals = "";
    switch (d.depth) {
        case 3: name2 = d.text; goals = "" + d.goals + " goals"; d = d.parent; 
        case 2: pos = d.key; d = d.parent; 
        case 1: team = d.key; 
        default : break;
    }

    var tspan = infoBox.selectAll("tspan")
        .data([team, pos, name2, goals]);
    
    tspan.enter()
        .append("tspan")
        .attr("x", "0")
        .attr("y", (d, i) => ""+ (i * 1.4)+"em");

    tspan.text((d) => d);
}

function calcAngle(x, dx) {
    return (x + (dx /2)) * 180 / Math.PI - 90;
}