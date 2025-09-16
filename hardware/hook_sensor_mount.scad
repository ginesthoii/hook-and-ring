// hook_sensor_mount.scad — parametric backplate + sensor pocket
// Units: mm

// --- Params ---
plate_w = 60;
plate_h = 80;
plate_t = 4;

standoff_dx = 0;      // lateral offset from plate center to hook line
standoff_dy = -10;    // vertical offset; negative = above midline
standoff_len = 18;    // how far sensor pocket protrudes
standoff_w = 18;
standoff_h = 16;

sensor_slot_w = 12;   // for small PCB hall modules; widen as needed
sensor_slot_h = 14;
sensor_slot_t = 6;    // slot depth

wire_ch = 6;          // wire channel diameter
hook_center_z = 0;    // reference plane for your hook

// screw holes
hole_d = 4;
hole_y_spacing = 50;

module rounded_plate(w, h, t, r=3) {
  linear_extrude(height=t)
    offset(r=r)
      square([w-2*r,h-2*r], center=true);
}

module mount() {
  // Backplate
  difference() {
    translate([0,0,0]) rounded_plate(plate_w, plate_h, plate_t, 3);
    // screw holes
    for (y=[-hole_y_spacing/2, hole_y_spacing/2])
      translate([0,y,-1]) cylinder(d=hole_d, h=plate_t+2, $fn=40);
  }

  // Standoff block
  translate([standoff_dx, standoff_dy, plate_t])
    difference() {
      cube([standoff_w, standoff_h, standoff_len], center=true);
      // sensor slot from front
      translate([0,0, (standoff_len/2) - sensor_slot_t])
        cube([sensor_slot_w, sensor_slot_h, sensor_slot_t+1], center=true);
      // wire channel from back
      translate([0, 0, -(standoff_len/2)+1])
        rotate([90,0,0]) cylinder(d=wire_ch, h=standoff_h+2, center=true, $fn=36);
    }
}

mount();