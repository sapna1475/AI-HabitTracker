//omport fn form date-fns for date math
import {format, subDays, startOfWeek , endOfWeek, eachDayOfInterval} from  "date-fns";

//helper to get date keys in the format
//today's date
export const toDateKey = (date) => format(date, "yyyy-MM-dd"); 
//shortcut to get current date key
export const todayKey = () => toDateKey(new Date()); 


//arr of 90 days keys
export const last90Days = () => {
    const end = new Date();
    const start = subDays(end, 89);
    return eachDayOfInterval({start, end}).map(toDateKey);

};

//to get the 7 days of the current week , start from mon
export const currentWeekKeys = () => {
    const now = new Date();
    const start = startOfWeek(now, {weekStartsOn: 1});
    const end = endOfWeek(now, {weekStartsOn : 1});
    return eachDayOfInterval({start, end }).map(toDateKey);
};

//returns the last n days keys, including today
export const lastNDays = (n) =>{
    const end = new Date();
    const start = subDays(end , n-1);
    return eachDayOfInterval({start, end}).map(toDateKey);
}

//returs longest 
export const calcStreak = (sortedDateKeys) => {
    //sDK is an array of date keys (most recent first)
    if(!sortedDateKeys.length) return {current :0, longest : 0};

    //create a set for O(1) lookups
    const set= new Set(sortedDateKeys);
    const today = todayKey();
    //yesterday is the date key for yesterday, used to check if the streak is currently active
    const yesterday = toDateKey(subDays(new Date(), 1));

    let current = 0;
    let cursor = new Date();    //start from today
    if(!set.has(today)  && !set.has(yesterday)) {    //if neither today nor yesterday is in the set, the streak is 0
        current = 0;

    } else{
        if(!set.has(today)) 
            cursor = subDays(cursor, 1); //if today is not in the set, start checking from yesterday
        while(set.has(toDateKey(cursor))) { 
            current++;
            cursor = subDays(cursor, 1); //move back one day
        }
    }

    const sortedAsc = [...sortedDateKeys].sort(); //sort in ascending order to calculate longest streak
    let longest = 0;
    let run = 0;         //current run of consecutive days
    let prev = null;     //prev date key means the last date key we saw in the loop
    for( const k of sortedAsc) {
        if(prev) {
            const d = new Date(k);
            const p = new Date(prev);
            const diff = Math.round((d-p) / (1000 * 60 * 60 * 24));      //calculate the difference in days between the current date key and the previous one

            if(diff === 1) run += 1;     //if today is not in the set, start checking from yesterday
            else run = 1;

        }else {
            run = 1;
        }
        if(run > longest) longest = run; 
        prev = k;    //current key

    }
    
    return {current , longest};

} 
