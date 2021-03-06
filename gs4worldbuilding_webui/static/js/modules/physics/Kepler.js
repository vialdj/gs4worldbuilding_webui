// Defines functions to solve
//
//  Keplers first, second, and third laws. 
//
// Credit for a lot of these go to Marc. A. Murison of US Naval Observatory, Washington, DC
// Link: http://murison.alpheratz.net/dynamics/twobody/KeplerIterations_summary.pdf
//

var SCALING_TIME = 0.1; // Set by GUI

// Uses threeJs.js clock. Substitute Clock.getElapsedTime with whatever your chosen timing engine is!
function CalculateMT(n, clock){
    var Mt = ((clock.getElapsedTime()) / n);
    return(Mt);
};

function KeplerStart(e,M){
    var t33,t35,t34;
    t34 = (Math.pow(e,2));
    t35 = e*t34;
    t33 = Math.cos(M);
    return((M+((-1/2*t35)+e+(t34+3/2*t33*t35)*t33)*Math.sin(M)));
};

function eps3(e,M,x){
  
    var t1,t2,t3,t4,t5,t6;
    t1 = Math.cos(x);
    t2 = -1+e*t1;
    t3 = Math.sin(x);
    t4 = e*t3;
    t5 = -x+t4+M;
    t6 = t5/(1/2*t5*t4/t2+t2);
    return(t5/((1/2*t3 - 1/6*t1*t6)*e*t6+t2));
  
};

function CalculateTrueAnomaly(eccentric_anomaly,Eccentricity,Retrograde){
  
    var e1,e2,e3,e4,e5;
    e1 = Math.sqrt(1-Eccentricity);
    e2 = Math.cos(eccentric_anomaly/2);
  
    e3 = Math.sqrt(1+Eccentricity);
    e4 = Math.sin(eccentric_anomaly/2);
  
    e5 = 2*Math.atan2(e3*e4,e1*e2);
  
    if(Retrograde == true){
        return(-e5);
    }
    else {
        return(e5);
    }
};

function KeplerSolve(e,M){
  var DE,E,E0,Mnorm,count;
  var tol = 1.0e-14;
  Mnorm = M%(2*Math.PI);
  E0 = KeplerStart(e,Mnorm);
  DE = tol + 1;
  
  count = 0;
  while(DE>tol){
    E = E0 - eps3(e,Mnorm,E0);
    DE = Math.abs(E-E0);
    E0 = E;
    count++;
    if(count==100){
       console.log("Too many iterations!");
       break;
    }
  };
  return(E);
};

export { CalculateTrueAnomaly, CalculateMT, KeplerSolve }